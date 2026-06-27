import sys
import wave
import struct
import math
from pathlib import Path
from loguru import logger

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.config import settings

BRIEFING_SCRIPT = (
    "Team briefing for Project IntelliMesh. The project is currently progressing on schedule. "
    "We have successfully completed the core backend architectures, including text chunking, "
    "vector store indexing with ChromaDB, and local generation via quantized model files. "
    "Our main risk is memory usage on low-end offline devices. To address this, we have optimized "
    "the pipeline to load models on demand and default to the compact Phi-2 model. "
    "Next steps: Nandini will finish the React dashboard, and we will execute integration tests."
)

def generate_gtts_audio(output_path: Path) -> bool:
    """
    Tries to generate real spoken speech audio using gTTS.
    Requires internet connection during execution of this script (which user runs before going offline).
    """
    try:
        from gtts import gTTS
        logger.info("gTTS is installed. Generating real speech audio file...")
        # Save transcript text alongside
        txt_path = output_path.with_suffix(".txt")
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(BRIEFING_SCRIPT)
            
        tts = gTTS(text=BRIEFING_SCRIPT, lang="en")
        mp3_path = output_path.with_suffix(".mp3")
        tts.save(str(mp3_path))
        logger.info(f"Successfully generated spoken briefing at: {mp3_path}")
        
        # If wav was requested, try converting if ffmpeg is present or write instructions
        logger.info(f"Transcript text saved to {txt_path}")
        return True
    except ImportError:
        logger.warning("gTTS not installed. Run 'pip install gTTS' to generate real spoken briefing audio.")
        return False
    except Exception as e:
        logger.error(f"gTTS audio generation failed: {e}")
        return False

def generate_mock_wav(output_path: Path):
    """
    Generates a valid, readable .wav file containing a basic synthetic tone.
    Whisper will be able to process this file (though it will transcribe as silence/music).
    This serves as an immediate offline fallback file.
    """
    logger.info("Generating a mock synthetic tone .wav file...")
    
    # 44100 Hz, 16-bit, mono, 3 seconds duration
    sample_rate = 44100.0
    duration = 3.0
    frequency = 440.0 # Standard A4 tone
    
    num_samples = int(duration * sample_rate)
    
    wav_file = wave.open(str(output_path), 'wb')
    wav_file.setnchannels(1) # mono
    wav_file.setsampwidth(2) # 16-bit
    wav_file.setframerate(int(sample_rate))
    
    for i in range(num_samples):
        # Generate sine wave
        value = int(32767.0 * math.sin(2.0 * math.pi * frequency * (i / sample_rate)))
        data = struct.pack('<h', value)
        wav_file.writeframesraw(data)
        
    wav_file.close()
    
    # Save transcript text alongside
    txt_path = output_path.with_suffix(".txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(BRIEFING_SCRIPT)
        
    logger.info(f"Successfully generated mock audio tone at: {output_path}")
    logger.info(f"Transcript text saved to {txt_path}")

def main():
    settings.create_dirs()
    target_wav_path = settings.SAMPLE_DOCS_DIR / "team_briefing.wav"
    
    # Try gTTS first (for real voice mp3)
    success = generate_gtts_audio(target_wav_path)
    
    # Always create the .wav file (either mock or print conversion steps)
    # The seed script looks for team_briefing.wav. If gTTS succeeded, we have .mp3.
    # We will generate a mock wav file to ensure a valid .wav file is always present.
    generate_mock_wav(target_wav_path)

if __name__ == "__main__":
    main()

