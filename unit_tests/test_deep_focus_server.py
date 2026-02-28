import requests
import time
import os
import glob

BASE_URL = "http://172.31.42.194:8000"

def run_tests():
    print("🚀 Starting Exhaustive API Tests...\n")

    # ---------------------------------------------------------
    # Test 1: Health Check
    # ---------------------------------------------------------
    print("Test 1: GET /healthz")
    try:
        res = requests.get(f"{BASE_URL}/healthz")
        res.raise_for_status()
        print("✅ Health check passed:", res.json())
    except Exception as e:
        print("❌ Health check failed:", e)
        return

    # ---------------------------------------------------------
    # Test 2: Ingest a Notification
    # ---------------------------------------------------------
    print("\nTest 2: POST /api/v1/notifications/ingest")
    ingest_payload = {
        "packageName": "com.whatsapp",
        "appName": "WhatsApp",
        "title": "Aradhya Lodu",
        "text": "Urgent call me right now",
        "time": int(time.time() * 1000),
        "notificationId": "test_notif_001",
        "isOngoing": False
    }
    
    try:
        res = requests.post(f"{BASE_URL}/api/v1/notifications/ingest", json=ingest_payload)
        res.raise_for_status()
        print("✅ Notification ingested successfully:")
        print("   Returned:", res.json())
    except Exception as e:
        print("❌ Notification ingest failed:", e)
        if res is not None:
            print("   Details:", res.text)
        return

    # Give ChromaDB a tiny fraction of a second to settle
    time.sleep(1)

    # ---------------------------------------------------------
    # Test 3: Query the Agent (Triggering Gemini + Pocket TTS)
    # ---------------------------------------------------------
    print("\nTest 3: POST /api/v1/agent/query")
    
    # Count how many .wav files exist before the test
    wav_files_before = set(glob.glob("voice_response_*.wav"))
    
    query_payload = {
        "query": "Is there anything urgent I need to look at right now?",
        "topK": 3
    }

    try:
        print("   Waiting for Gemini LLM and Pocket TTS generation (this may take a few seconds)...")
        res = requests.post(f"{BASE_URL}/api/v1/agent/query", json=query_payload)
        res.raise_for_status()
        data = res.json()
        print("✅ Agent query successful!")
        print(f"   Agent Response Text: '{data['response']}'")
        print(f"   Matched Notifications: {data['matchedNotifications']}")
    except Exception as e:
        print("❌ Agent query failed:", e)
        if res is not None:
            print("   Details:", res.text)
        return

    # ---------------------------------------------------------
    # Test 4: Verify .wav file creation
    # ---------------------------------------------------------
    print("\nTest 4: Verifying Audio File Generation")
    wav_files_after = set(glob.glob("voice_response_*.wav"))
    new_files = wav_files_after - wav_files_before
    
    if new_files:
        new_file = list(new_files)[0]
        file_size = os.path.getsize(new_file)
        print(f"✅ Found new audio file: {new_file} ({file_size} bytes)")
        if file_size > 1000:
            print("   File size looks healthy (not empty).")
        else:
            print("⚠️ File is suspiciously small. Might be corrupted or empty.")
    else:
        print("❌ No new .wav file was generated in the current directory.")

    print("\n🎉 All tests completed. Please listen to the generated .wav file to verify audio quality!")

if __name__ == "__main__":
    run_tests()