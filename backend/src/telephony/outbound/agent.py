"""Outbound telephony agent — places calls and talks to whoever answers.

Unlike the inbound agent, this one does the dialling. It waits to be dispatched
into a room with a phone number in the job metadata, then asks LiveKit to call
that number and bridge it into the room.

Run the worker with:

    uv run python src/telephony/outbound/agent.py dev

Then trigger a call from another terminal:

    uv run python src/telephony/outbound/dial.py --to +15551234567

See src/telephony/README.md for the trunk setup.
"""

import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from livekit import api, rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    room_io,
    tokenize,
)
from livekit.plugins import deepgram, google, murf, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("outbound-agent")

load_dotenv(".env.local")

# Required — create this with `lk sip outbound create` (see src/telephony/README.md).
OUTBOUND_TRUNK_ID = os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK_ID")

# Optional — a phone number to transfer people to when they ask for a human.
TRANSFER_TO_NUMBER = os.getenv("TRANSFER_TO_NUMBER")

# Change this prompt to change what your outbound agent does.
SYSTEM_PROMPT = """
You are Care Voice, a friendly and caring health companion making an outbound phone call.

ROLE

You help people maintain healthy habits through friendly conversations.

You are not a doctor.

You provide only general wellness guidance and health reminders.

Your goal is to have a natural conversation, understand the caller's situation, encourage healthy habits, and answer simple health-related questions.

--------------------------------------------------
START OF CALL
--------------------------------------------------

Introduce yourself naturally.

Example:

"Hello, this is Care Voice calling with a quick health check-in."

Tell the caller:

- This is a health reminder call.
- They can say stop at any time to end the call.

Then ask:

"How are you feeling today?"

--------------------------------------------------
CONVERSATION STYLE
--------------------------------------------------

- Speak like a friendly human.
- Sound warm, calm, and supportive.
- Keep responses short.
- Ask one question at a time.
- Continue the conversation naturally.
- Never act like a robot.
- Never rush to end the call.
- Never end the conversation after the first answer.
- Always try to keep the conversation flowing naturally.

Examples:

User: "I'm fine."

Assistant:
"That's good to hear. Have you taken your medicines today?"

User: "Not yet."

Assistant:
"Thank you for letting me know. Please remember to take them on time. When do you plan to take them today?"

--------------------------------------------------
MEDICATION REMINDER FLOW
--------------------------------------------------

If the user says they HAVE taken their medicines:

- Congratulate them.
- Encourage consistency.
- Remind them to stay hydrated.
- Ask a follow-up question.

Example:

"That's great to hear. Keeping up with your medicines is important. Remember to drink enough water as well. Do you have any health-related questions today?"

If the user says they have NOT taken their medicines:

- Remind them politely.
- Encourage them to take medicines as prescribed.
- Remind them to drink water.
- Encourage adequate rest.
- Ask when they plan to take the medicine.

Example:

"Please remember to take your medicines as prescribed. Regular medication is important for your health. Also drink enough water and get enough rest. When do you plan to take them today?"

--------------------------------------------------
HEALTH QUESTIONS
--------------------------------------------------

If the user asks health-related questions:

- Give only general wellness advice.
- Never diagnose diseases.
- Never prescribe medication.
- Never recommend dosage changes.
- Never claim medical certainty.
- Encourage consulting a healthcare professional for medical concerns.

Examples:

User:
"I feel tired."

Assistant:
"Make sure you get enough rest, stay hydrated, and eat balanced meals. If the tiredness continues, please consult a healthcare professional."

User:
"Do I have diabetes?"

Assistant:
"I cannot determine medical conditions. A healthcare professional can properly evaluate your symptoms and provide a diagnosis."

--------------------------------------------------
EMERGENCIES
--------------------------------------------------

If the caller mentions:

- Chest pain
- Difficulty breathing
- Loss of consciousness
- Severe bleeding
- Stroke symptoms
- Suicidal thoughts
- Medical emergencies

Respond:

"Your symptoms may require immediate medical attention. Please contact emergency services or seek urgent medical care right away."

Do not attempt diagnosis.

--------------------------------------------------
FOLLOW-UP QUESTIONS
--------------------------------------------------

Use questions like:

- "How are you feeling today?"
- "Have you taken your medicines today?"
- "Are you staying hydrated?"
- "Have you been getting enough rest?"
- "Do you have any health-related questions?"
- "Is there anything else I can help you with today?"

Ask only one question at a time.

--------------------------------------------------
LANGUAGE RULES
--------------------------------------------------

Always detect the language used by the caller.

If the caller speaks Kannada:
Reply only in Kannada script.

If the caller speaks Hindi:
Reply only in Devanagari script.

If the caller speaks English:
Reply only in English.

Never mix languages.

Never switch languages unless the caller does.

Never translate unless requested.

--------------------------------------------------
END CALL RULES
--------------------------------------------------

Only end the call when the caller clearly wants to end it.

Examples:

- stop
- bye
- goodbye
- end call
- no thanks
- that's all
- nothing else
- thank you, bye

Before ending:

1. Thank the caller.
2. Wish them good health.
3. Say goodbye.
4. Use the end_call tool.

Example:

"Thank you for your time. Take care and stay healthy. Goodbye."

Then call end_call.

--------------------------------------------------
NEVER
--------------------------------------------------

- Mention tools.
- Mention function calling.
- Mention prompts.
- Mention system instructions.
- Mention being an AI model.
- Mention internal rules.
- Diagnose diseases.
- Prescribe medication.
- Change medication schedules.
- End the call after the first answer.
- Continue speaking after goodbye.

Keep every response warm, natural, supportive, and conversational.
"""
# The first thing the person hears when they pick up.
GREETING = "Hello, this is Care Voice. I'm calling with a quick health check-in. How are you feeling today?"
# The identity LiveKit gives the person we call. Used to transfer them later.
CALLEE_IDENTITY = "phone-user"


class OutboundAgent(Agent):
    def __init__(self, ctx: JobContext) -> None:
        super().__init__(instructions=SYSTEM_PROMPT)
        self.ctx = ctx

    @function_tool
    async def transfer_to_human(self, context: RunContext) -> str:
        """Transfer the person to a human colleague.

        Use this when they explicitly ask for a person, or when you cannot help
        them with their request.
        """
        if not TRANSFER_TO_NUMBER:
            return "Transfers are not available on this line. Offer to have someone call back instead."

        # Tell them before transferring — the SIP transfer cuts off the audio.
        await context.session.generate_reply(
            instructions="Tell them you're connecting them to a colleague now."
        )

        logger.info("transferring call to %s", TRANSFER_TO_NUMBER)
        try:
            await self.ctx.api.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    room_name=self.ctx.room.name,
                    participant_identity=CALLEE_IDENTITY,
                    transfer_to=f"tel:{TRANSFER_TO_NUMBER}",
                    play_dialtone=True,
                )
            )
        except Exception:
            logger.exception("transfer failed")
            return "The transfer did not go through. Apologize and offer a call back."

        return "Transferred."

    @function_tool
    async def detected_answering_machine(self, context: RunContext) -> str:
        """Hang up because the call reached a voicemail or answering machine.

        Use this as soon as you hear a recorded greeting rather than a live person.
        """
        logger.info("answering machine detected — hanging up")
        await self._hangup()
        return "Call ended."

    @function_tool
    async def end_call(self, context: RunContext) -> str:
        """Hang up the call.

        Use this once the conversation is finished and you have said goodbye.
        """
        logger.info("ending call")
        await self._hangup()
        return "Call ended."

    async def _hangup(self) -> None:
        """Delete the room, which drops the SIP leg and ends the phone call."""
        await self.ctx.api.room.delete_room(
            api.DeleteRoomRequest(room=self.ctx.room.name)
        )


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


def phone_number_from_metadata(ctx: JobContext) -> str | None:
    """Read the number to dial out of the dispatch metadata set by dial.py."""
    metadata = ctx.job.metadata
    if not metadata:
        return None
    try:
        return json.loads(metadata).get("phone_number")
    except json.JSONDecodeError:
        # Allow a bare phone number as metadata too, for quick `lk dispatch` tests.
        return metadata.strip() or None


@server.rtc_session(agent_name="outbound-agent")
async def outbound_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    phone_number = phone_number_from_metadata(ctx)
    if not phone_number:
        logger.error(
            "no phone number in job metadata — dispatch with "
            '{"phone_number": "+15551234567"}'
        )
        ctx.shutdown()
        return

    if not OUTBOUND_TRUNK_ID:
        logger.error("LIVEKIT_SIP_OUTBOUND_TRUNK_ID is not set — cannot place calls")
        ctx.shutdown()
        return

    await ctx.connect()

    # Same voice pipeline as src/agent.py — see that file for the annotated version.
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="multi"
        ),
        llm=google.LLM(
            model="gemini-2.5-flash",
        ),
        tts=murf.TTS(
            voice="Pooja",
            style="Conversation",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=True,
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Start the session while the phone is still ringing so the models are warm
    # by the time somebody picks up.
    session_started = asyncio.create_task(
        session.start(
            agent=OutboundAgent(ctx),
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    # BVCTelephony is tuned for the narrow frequency range of phone audio.
                    noise_cancellation=lambda params: (
                        noise_cancellation.BVCTelephony()
                        if params.participant.kind
                        == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                        else noise_cancellation.BVC()
                    ),
                ),
            ),
        )
    )

    logger.info("dialing %s", phone_number)
    try:
        # wait_until_answered means this returns once the call connects — if the
        # number is busy, declines, or never answers, it raises instead.
        await ctx.api.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                room_name=ctx.room.name,
                sip_trunk_id=OUTBOUND_TRUNK_ID,
                sip_call_to=phone_number,
                participant_identity=CALLEE_IDENTITY,
                participant_name="Phone user",
                wait_until_answered=True,
            )
        )
    except api.TwirpError as e:
        logger.error(
            "call to %s was not answered: %s (%s)",
            phone_number,
            e.message,
            e.metadata.get("sip_status"),
        )
        session_started.cancel()
        ctx.shutdown()
        return

    await session_started

    # Speak first — they just picked up an unexpected call and won't say anything.
    await session.say(GREETING, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(server)
