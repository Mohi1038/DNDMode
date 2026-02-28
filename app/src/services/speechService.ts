import { NativeModules, DeviceEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { audioPlayerService } from './audioPlayerService';
import { API_CONFIG } from '../config/apiConfig';

const { SpeechToTextModule } = NativeModules;

const WAKE_WORD = 'hey diddy';

type State = 'IDLE' | 'WAITING_FOR_WAKE_WORD' | 'LISTENING_FOR_COMMAND';

interface SpeechResult {
    text: string;
    isFinal: boolean;
}

interface SpeechError {
    code: string;
    message: string;
}

type WakeCallback = () => void;
type CommandCallback = (command: string) => void;
type ErrorCallback = (error: SpeechError) => void;

class SpeechService {
    private subscriptions: EmitterSubscription[] = [];
    private state: State = 'IDLE';
    private onWake: WakeCallback | null = null;
    private onCommand: CommandCallback | null = null;
    private onError: ErrorCallback | null = null;

    async requestPermission(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;

        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                    title: 'Microphone Permission',
                    message: 'DND Mode needs access to your microphone for voice commands.',
                    buttonPositive: 'Allow',
                    buttonNegative: 'Deny',
                },
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.error('[SpeechService] Permission error:', err);
            return false;
        }
    }

    async startSTT(
        onWake?: WakeCallback,
        onCommand?: CommandCallback,
        onError?: ErrorCallback,
    ): Promise<boolean> {
        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
            console.warn('[SpeechService] Microphone permission denied');
            return false;
        }

        this.onWake = onWake || null;
        this.onCommand = onCommand || null;
        this.onError = onError || null;
        this.state = 'WAITING_FOR_WAKE_WORD';

        this.subscriptions.push(
            DeviceEventEmitter.addListener('onSpeechResult', (event: SpeechResult) => {
                if (!event.isFinal) return;

                const text = event.text.toLowerCase().trim();
                console.log(`[SpeechService] [${this.state}] Heard: "${text}"`);

                if (this.state === 'WAITING_FOR_WAKE_WORD') {
                    if (
                        text.includes(WAKE_WORD) ||
                        text.includes('hey didi') ||
                        text.includes('a diddy') ||
                        text.includes('hey did he')
                    ) {
                        console.log('[SpeechService] 🎯 Wake word detected!');
                        this.state = 'LISTENING_FOR_COMMAND';
                        this.onWake?.();

                        const afterWake = this.extractCommandAfterWakeWord(text);
                        if (afterWake) {
                            this.processCommand(afterWake);
                        }
                    }
                } else if (this.state === 'LISTENING_FOR_COMMAND') {
                    this.processCommand(text);
                }
            }),
        );

        this.subscriptions.push(
            DeviceEventEmitter.addListener('onSpeechError', (event: SpeechError) => {
                if (this.state === 'LISTENING_FOR_COMMAND') {
                    this.state = 'WAITING_FOR_WAKE_WORD';
                }
                this.onError?.(event);
            }),
        );

        SpeechToTextModule.startListening();
        console.log('[SpeechService] Started — say "Hey Diddy" to activate');
        return true;
    }

    private extractCommandAfterWakeWord(text: string): string | null {
        const variations = [WAKE_WORD, 'hey didi', 'a diddy', 'hey did he'];
        for (const variant of variations) {
            const idx = text.indexOf(variant);
            if (idx !== -1) {
                const after = text.substring(idx + variant.length).trim();
                if (after.length > 0) return after;
            }
        }
        return null;
    }

    private async processCommand(command: string) {
        console.log(`[SpeechService] 📤 Command: "${command}"`);
        this.onCommand?.(command);
        this.state = 'WAITING_FOR_WAKE_WORD';

        // Send to backend agent → receive audio URL → play
        await this.queryAndPlay(command);
    }

    private async queryAndPlay(query: string): Promise<void> {
        try {
            console.log('[SpeechService] Querying agent...');
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/agent/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();

            if (data.status === 'ok' && data.audioUrl) {
                console.log('[SpeechService] 🔊 Playing audio:', data.audioUrl);
                await audioPlayerService.playFromUrl(data.audioUrl);
            } else if (data.status === 'ok' && data.text) {
                console.log('[SpeechService] 💬 AI response:', data.text);
            } else {
                console.warn('[SpeechService] Agent returned no audio:', data);
            }
        } catch (error) {
            console.error('[SpeechService] Agent query failed:', error);
        }
    }

    stopSTT(): void {
        SpeechToTextModule.stopListening();
        this.state = 'IDLE';
        this.cleanup();
    }

    destroy(): void {
        SpeechToTextModule.destroy();
        this.state = 'IDLE';
        this.cleanup();
    }

    private cleanup(): void {
        this.subscriptions.forEach(sub => sub.remove());
        this.subscriptions = [];
        this.onWake = null;
        this.onCommand = null;
        this.onError = null;
    }
}

export const speechService = new SpeechService();
