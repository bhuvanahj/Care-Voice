import logging
import json
import os
import random
import string
import uuid
from datetime import datetime

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    inference,
    tokenize,
    room_io,
)
from memory import get_user_memory, save_user_memory
from livekit.plugins import murf, silero, google, deepgram, noise_cancellation
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env.local")


ESCALATIONS_FILE = "escalations.json"
CALLS_FILE = "calls.json"


def generate_reference_id() -> str:
    """Generate a short, human-readable escalation reference ID, e.g. ESC-AB12CD."""
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"ESC-{suffix}"


def save_escalation(record: dict) -> None:
    """Append an escalation record to a local JSON file (simplest durable store)."""
    data = []
    if os.path.exists(ESCALATIONS_FILE):
        with open(ESCALATIONS_FILE, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = []
    data.append(record)
    with open(ESCALATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_call(record: dict) -> None:
    """Append a call-analytics record to a local JSON file.

    Intentionally holds no transcript, symptom text, OTP/PIN, or account
    data — only call lifecycle facts needed for Total/Successful/Failed
    and non-sensitive call history.
    """
    data = []
    if os.path.exists(CALLS_FILE):
        with open(CALLS_FILE, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = []
    data.append(record)
    with open(CALLS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


SYSTEM_PROMPT = """
IDENTITY

You are Care Voice, an AI health companion designed for elderly people in India.

FIRST GREETING

Hello! I'm Care Voice, your AI health companion.
I can help with healthy habits, medicine reminders, wellness tips, and general health guidance.
How can I help you today?

OBJECTIVES

1. Help users maintain healthy daily habits.
2. Provide simple wellness and lifestyle guidance.
3. Encourage users to seek professional medical care when necessary.
4. Remind users to drink water.
5. Encourage regular walking.
6. Encourage medication adherence.
7. Promote healthy sleep habits.

KNOWLEDGE

You can provide:

- General health information
- Nutrition and hydration advice
- Exercise and sleep guidance
- Medicine reminder support
- Emotional encouragement

You cannot diagnose diseases or prescribe medicines.

LANGUAGE

- Match the user's language.
- If the user speaks Kannada, reply in Kannada.
- If the user speaks Hindi, reply in Hindi.
- If the user speaks English, reply in English.
- If the user mixes Kannada and English, naturally mix Kannada and English.
- If the user mixes Hindi and English, naturally mix Hindi and English.
- Always write non-English languages in their native script.
- Kannada must use Kannada script.
- Hindi must use Devanagari script.
- Never romanize Kannada or Hindi unless the user explicitly asks for it.
- Keep language simple and conversational.
- Do not translate unless asked.

TOOLS

You have a symptom triage tool called check_symptom_triage.

When the user describes symptoms or asks whether their symptoms require
urgent medical attention, use the check_symptom_triage tool before answering.

Speak the result naturally and briefly.
Never mention the internal tool name.
Never return raw tool output.
The tool is a basic rule-based helper and is NOT a medical diagnosis.

GUARDRAILS

Never:

- Diagnose diseases
- Prescribe medicines
- Recommend prescription drugs
- Claim to be a doctor
- Guarantee medical outcomes

HUMAN ESCALATION

Trigger escalation for:
- chest pain
- breathing difficulty
- severe bleeding
- loss of consciousness
- stroke symptoms
- suicidal thoughts
- the user asking you for a diagnosis

When triggered:

1. If it is a medical emergency (chest pain, breathing difficulty, severe
   bleeding, loss of consciousness, stroke symptoms, suicidal thoughts), say:

   "This may require immediate medical attention. Please contact a doctor,
   family member, caregiver, or visit the nearest hospital immediately."

2. Then, regardless of emergency or diagnosis-request, ask permission before
   creating any escalation record:

   "I may need to create a request for a healthcare professional.
   I would share: your name, issue summary, and urgency level.
   Do I have your permission?"

3. Only after the user says yes, call create_escalation with their name,
   a short factual issue summary (no diagnosis), urgency level, the
   language they've been speaking, and their follow-up preference if
   they've stated one (otherwise "not specified").

4. After the tool returns, speak the reference ID clearly and tell them
   the honest next step: a healthcare professional or caregiver will
   follow up, and if it's an emergency they should not wait for that
   follow-up — they should seek help immediately.

5. If the user says no, do not call create_escalation. Respect their answer
   and do not ask again in the same session unless new emergency symptoms
   come up.

Never mention the internal tool name. Never diagnose. Never guess a
diagnosis instead of escalating.

STYLE

- Warm and respectful
- Maximum 2-3 sentences
- Easy for elderly users to understand
- Calm and reassuring

If a user mentions their age, medication schedule, sleep routine,
or water intake goals during the conversation, remember it within
the current session and use it to provide more personalized reminders.
"""


class Assistant(Agent):
    def __init__(self, instructions: str, user_id: str, call_record: dict) -> None:
        super().__init__(instructions=instructions)
        self.user_id = user_id
        # Mutable dict shared with the calling job function so this session
        # can report back whether an escalation was created, without the
        # call log ever containing transcript or symptom text.
        self.call_record = call_record

    @function_tool
    async def save_memory(
        self,
        context: RunContext,
        name: str,
        memory_summary: str,
    ) -> str:
        """Save user memory after explicit consent.

        Call this ONLY immediately after the user has explicitly said yes
        to the memory consent question.

        Args:
            name: The user's first name, as they told you.
            memory_summary: A short 1-2 sentence summary of health-relevant
                facts they shared.
        """
        save_user_memory(self.user_id, name, memory_summary)
        logger.info(f"Saved memory for user {self.user_id}")
        return "Got it, I'll remember that."

    @function_tool
    async def check_symptom_triage(
        self,
        context: RunContext,
        symptoms: str,
    ) -> str:
        """Assess the urgency of symptoms described by the user.

        Use this when the user describes symptoms and asks about urgency
        or whether they need medical attention.

        This is a basic rule-based helper, not a medical diagnosis.

        Args:
            symptoms: A short description of the user's symptoms.
        """

        if not symptoms.strip():
            return (
                "I could not identify the symptoms clearly. "
                "Please describe what you are experiencing."
            )

        text = symptoms.lower()

        emergency_terms = [
            "chest pain",
            "difficulty breathing",
            "can't breathe",
            "cannot breathe",
            "loss of consciousness",
            "unconscious",
            "stroke",
            "severe bleeding",
            "suicidal",
        ]

        urgent_terms = [
            "high fever",
            "persistent vomiting",
            "severe pain",
            "dehydration",
            "fainting",
            "blood in vomit",
            "blood in stool",
        ]

        if any(term in text for term in emergency_terms):
            return (
                "Triage level: EMERGENCY. "
                "This may require immediate medical attention. "
                "Please contact emergency services or go to the nearest "
                "hospital immediately."
            )

        if any(term in text for term in urgent_terms):
            return (
                "Triage level: URGENT. "
                "Please seek medical evaluation promptly, especially "
                "if the symptoms worsen."
            )

        return (
            "Triage level: ROUTINE. "
            "No emergency symptom was detected by this basic rule-based "
            "check. Monitor the symptoms and consult a healthcare "
            "professional if they persist or worsen."
        )

    @function_tool
    async def create_escalation(
        self,
        context: RunContext,
        name: str,
        issue_summary: str,
        urgency: str,
        language: str,
        follow_up_preference: str,
    ) -> str:
        """Create a human escalation request. Call this ONLY after the user
        has explicitly said yes to sharing their information.

        Args:
            name: The user's name.
            issue_summary: A short, factual summary of what was reported —
                symptoms or the request — with no diagnosis or medical judgment.
            urgency: One of "emergency", "urgent", or "routine".
            language: The language the user has been speaking, e.g. "kannada",
                "hindi", or "english".
            follow_up_preference: How the user wants to be contacted, e.g.
                "phone call", "family member", "visit hospital", or
                "not specified".
        """
        reference_id = generate_reference_id()
        record = {
            "reference_id": reference_id,
            "user_id": self.user_id,
            "name": name,
            "issue_summary": issue_summary,
            "urgency": urgency,
            "language": language,
            "follow_up_preference": follow_up_preference,
            "created_at": datetime.utcnow().isoformat(),
        }
        save_escalation(record)

        # Feed back into this call's analytics record — this is what lets
        # the dashboard mark the call as a successful "appropriate
        # escalation created" outcome rather than just "completed".
        self.call_record["escalation_created"] = True
        self.call_record["escalation_reference_id"] = reference_id

        logger.info(f"Created escalation {reference_id} for user {self.user_id}")
        return (
            f"Escalation created. Reference ID: {reference_id}. "
            "A healthcare professional or caregiver contact will follow up."
        )


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # --- Call analytics tracking (Day 8) -----------------------------
    # One record per call, written in `finally` so it's captured whether
    # the call completes normally or the session raises/disconnects.
    call_id = str(uuid.uuid4())
    started_at = datetime.utcnow()
    call_status = "failed"
    call_record = {"escalation_created": False, "escalation_reference_id": None}
    # -------------------------------------------------------------------

    try:
        await ctx.connect()

        participant = await ctx.wait_for_participant()
        user_id = participant.identity

        existing = get_user_memory(user_id)

        if existing:
            memory_block = f"""
RETURNING USER CONTEXT

This user has spoken with you before.

Name: {existing['name']}
What you remember about them: {existing['memory_summary']}

Greet them by name and briefly reference what you remember,
then ask how they've been since then.

Do not ask the consent question again this session unless they
share new information. If they share new information, confirm
consent before calling save_memory again.
"""
        else:
            memory_block = """
NEW USER

You have no memory of this user yet.

If, during the conversation, they share their name along with
personal health information such as symptoms, routines, or
medication schedules, ask this exact question once:

"Can I remember information from our conversations so I can assist you better next time?"

If they say yes, call the save_memory tool with their name
and a short summary.

If they say no, do not save anything and do not ask again
this session.
"""

        instructions = SYSTEM_PROMPT + "\n" + memory_block

        session = AgentSession(
            stt=deepgram.STT(
                model="nova-3",
                language="multi",
            ),
            llm=google.LLM(
                model="gemini-2.5-flash",
            ),
            tts=murf.TTS(
                voice="Pooja",
                style="Conversation",
                tokenizer=tokenize.basic.SentenceTokenizer(
                    min_sentence_len=2
                ),
                text_pacing=True,
            ),
            turn_detection=MultilingualModel(),
            vad=ctx.proc.userdata["vad"],
            preemptive_generation=True,
        )

        await session.start(
            agent=Assistant(
                instructions=instructions,
                user_id=user_id,
                call_record=call_record,
            ),
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=lambda params: (
                        noise_cancellation.BVCTelephony()
                        if params.participant.kind
                        == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                        else noise_cancellation.BVC()
                    ),
                ),
            ),
        )

        call_status = "completed"

    except Exception:
        call_status = "failed"
        logger.exception(f"Call {call_id} ended with an error")
        raise

    finally:
        ended_at = datetime.utcnow()
        duration_seconds = round((ended_at - started_at).total_seconds(), 1)
        save_call(
            {
                "call_id": call_id,
                "started_at": started_at.isoformat(),
                "ended_at": ended_at.isoformat(),
                "duration_seconds": duration_seconds,
                "status": call_status,
                # Health Access success = call completed (safe guidance
                # delivered), whether or not an escalation was also
                # appropriately created along the way.
                "success": call_status == "completed",
                "escalation_created": call_record["escalation_created"],
                "escalation_reference_id": call_record["escalation_reference_id"],
            }
        )


if __name__ == "__main__":
    cli.run_app(server)