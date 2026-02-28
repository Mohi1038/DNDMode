import time
import scipy.io.wavfile
from pocket_tts import TTSModel

def interactive_tts():
    print("Loading the TTS model into memory (this happens only once)...")
    tts_model = TTSModel.load_model()
    
    print("Loading the voice profile...")
    voice_state = tts_model.get_state_for_audio_prompt("alba")
    
    print("\n✅ Ready! The model is now loaded and will respond quickly.")
    print("Type 'quit' or 'exit' to stop.\n")
    
    counter = 1
    while True:
        # 1. Get user input
        text = input("Enter text to synthesize: ").strip()
        
        if text.lower() in ['quit', 'exit']:
            print("Exiting...")
            break
            
        if not text:
            continue
            
        output_filepath = f"generated_voice_{counter}.wav"
        
        # 2. Start timing the generation process
        start_time = time.time()
        
        # 3. Generate the audio
        audio = tts_model.generate_audio(voice_state, text)
        
        # 4. Stop timing
        end_time = time.time()
        generation_time = end_time - start_time
        
        # 5. Save the file
        scipy.io.wavfile.write(output_filepath, tts_model.sample_rate, audio.numpy())
        
        # 6. Report the results
        print(f"🔊 Saved to {output_filepath}")
        print(f"⏱️  Time taken to generate: {generation_time:.3f} seconds\n")
        
        counter += 1

if __name__ == "__main__":
    interactive_tts()