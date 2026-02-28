import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
    Modal, Platform, Alert, Vibration, ActivityIndicator, TextInput,
    Share, NativeModules, AppState
} from 'react-native';
import { API_CONFIG } from '../config/apiConfig';
import DigitalGovernanceScreen, { AppSchedule } from './DigitalGovernanceScreen';
import { updateRemainingTime } from '../services/AppTimerService';
import { digitalWellbeingService } from '../services/digitalWellbeingService';


const { InstalledAppsModule } = NativeModules;

const triggerHaptic = (type: 'light' | 'medium' | 'heavy') => {
    if (Platform.OS === 'ios') {
        Vibration.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
    } else {
        Vibration.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
    }
};

interface GroupDashboardProps {
    groupId: string;
    userName: string;
    onExit: () => void;
}

export default function GroupDashboardScreen({ groupId, userName, onExit }: GroupDashboardProps) {
    const [groupData, setGroupData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAppPicker, setShowAppPicker] = useState(false);
    const [installedApps, setInstalledApps] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [nowTs, setNowTs] = useState(Date.now());
    const [showTotalTimeModal, setShowTotalTimeModal] = useState(false);
    const [totalTimeInput, setTotalTimeInput] = useState('');
    const wsRef = useRef<WebSocket | null>(null);
    const usageBaselineRef = useRef<{ [pkg: string]: number }>({});
    const groupDataRef = useRef<any>(null);
    const appBackgroundAtRef = useRef<number | null>(null);

    const currentUserMember = Array.isArray(groupData?.members)
        ? groupData.members.find((m: any) => String(m?.name || '').toLowerCase() === String(userName || '').toLowerCase())
        : null;

    useEffect(() => {
        groupDataRef.current = groupData;
    }, [groupData]);

    useEffect(() => {
        fetchGroupStatus();
        fetchInstalledApps();
        const interval = setInterval(fetchGroupStatus, 8000); // Fallback sync

        const wsUrl = (() => {
            try {
                const parsed = new URL(API_CONFIG.BASE_URL);
                const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
                return `${wsProtocol}//${parsed.host}/ws/groups?groupId=${encodeURIComponent(groupId)}&userName=${encodeURIComponent(userName)}`;
            } catch {
                return `ws://localhost:5000/ws/groups?groupId=${encodeURIComponent(groupId)}&userName=${encodeURIComponent(userName)}`;
            }
        })();

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload?.type === 'group:update' && payload?.group) {
                    setGroupData(payload.group);
                    setIsLoading(false);
                } else if (payload?.type === 'TIME_UPDATE' && payload?.data) {
                    // Update remaining time locally via Kotlin native module
                    Object.entries(payload.data).forEach(([packageName, remainingSeconds]) => {
                        updateRemainingTime(packageName, remainingSeconds as number)
                            .catch(e => console.error(`Failed to update remaining time for ${packageName}`, e));
                    });
                }
            } catch {
                // ignore malformed payload
            }
        };

        socket.onerror = () => {
            console.warn('Group websocket error, continuing with polling fallback');
        };

        return () => {
            clearInterval(interval);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, []);

    useEffect(() => {
        const tick = setInterval(() => {
            setNowTs(Date.now());
        }, 1000);

        return () => clearInterval(tick);
    }, []);

    // Usage reporting effect
    useEffect(() => {
        let isChecking = false;

        const checkUsage = async () => {
            if (isChecking) return;
            const currentGroup = groupDataRef.current;
            if (!currentGroup?.sessionStarted) return;

            const me = currentGroup.members?.find((m: any) => String(m?.name || '').toLowerCase() === String(userName || '').toLowerCase());
            if (!me || !me.selectedApps || me.selectedApps.length === 0) return;

            isChecking = true;
            try {
                const stats = await digitalWellbeingService.getTodayUsageStats();

                for (const app of me.selectedApps) {
                    const pkg = app.packageName;
                    const stat = stats.find(s => s.packageName === pkg);
                    if (!stat) continue;

                    const currentForegroundMs = stat.totalTimeInForeground;
                    const previousForegroundMs = usageBaselineRef.current[pkg];

                    if (previousForegroundMs !== undefined) {
                        const deltaMs = currentForegroundMs - previousForegroundMs;
                        // To avoid spamming, only report if delta is at least 30 seconds
                        if (deltaMs >= 30000) {
                            const usedMins = deltaMs / 60000;

                            // Immediately update baseline to avoid double reporting
                            usageBaselineRef.current[pkg] = currentForegroundMs;

                            try {
                                await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}/usage-event`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userName, appPackageName: pkg, usedMins })
                                });
                                console.log(`[Usage] Reported ${usedMins.toFixed(2)} mins for ${pkg}`);
                            } catch (e) {
                                console.error('[Usage] Failed to report', e);
                                // Revert baseline if failed
                                usageBaselineRef.current[pkg] = previousForegroundMs;
                            }
                        }
                    } else {
                        // Initialize baseline
                        usageBaselineRef.current[pkg] = currentForegroundMs;
                    }
                }
            } catch (err) {
                console.error('[Usage Check Error]', err);
            } finally {
                isChecking = false;
            }
        };

        const usageInterval = setInterval(checkUsage, 10000); // Check every 10s

        // Also check when app comes to foreground
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                checkUsage();
            }
        });

        return () => {
            clearInterval(usageInterval);
            subscription.remove();
        };
    }, [groupId, userName]);

    const fetchInstalledApps = async () => {
        try {
            if (InstalledAppsModule) {
                const apps = await InstalledAppsModule.getSortedApps();
                setInstalledApps(apps);
            } else {
                console.warn('InstalledAppsModule native module not available');
                setInstalledApps([]);
            }
        } catch (e) {
            console.warn('Failed to get installed apps:', e);
            setInstalledApps([]);
        }
    };

    const handleMissingGroup = () => {
        Alert.alert(
            'Group Expired',
            'This group no longer exists on server (likely after backend restart). Please create or join the group again.',
            [{ text: 'OK', onPress: onExit }]
        );
    };

    const readApiBody = async (response: Response) => {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch {
                return { error: 'Invalid JSON from server.' };
            }
        }

        const raw = await response.text();
        try {
            return JSON.parse(raw);
        } catch {
            return { error: raw };
        }
    };

    const fetchGroupStatus = async () => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}`);
            const data = await readApiBody(response);
            if (response.ok) {
                setGroupData(data);
            } else if (response.status === 404) {
                handleMissingGroup();
            }
        } catch (error) {
            console.error('Failed to sync group state:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const reportBackgroundUsage = async (usedMins: number) => {
        if (!Number.isFinite(usedMins) || usedMins <= 0) {
            return;
        }

        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}/usage-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userName,
                    appPackageName: 'outside.dndmode',
                    usedMins,
                }),
            });

            const data = await readApiBody(response);

            if (response.ok) {
                setGroupData(data?.group || data);
                return;
            }

            if (response.status === 404) {
                handleMissingGroup();
                return;
            }

            console.warn('Failed to report background usage:', data?.error || response.status);
        } catch (error) {
            console.warn('Failed to report background usage:', error);
        }
    };

    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background' || nextState === 'inactive') {
                appBackgroundAtRef.current = Date.now();
                return;
            }

            if (nextState !== 'active') {
                return;
            }

            const leftAt = appBackgroundAtRef.current;
            appBackgroundAtRef.current = null;

            if (!leftAt) {
                return;
            }

            const awayMs = Date.now() - leftAt;
            if (awayMs < 60_000) {
                return;
            }

            const usedMins = Math.floor(awayMs / 60_000);
            reportBackgroundUsage(usedMins);
        });

        return () => sub.remove();
    }, []);

    const handleShare = async () => {
        if (!groupData) return;
        try {
            await Share.share({
                message: `Join my focus group on DNDMode! Code: ${groupData.code}\nLink: ${groupData.inviteLink}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const proposeApps = async (apps: AppSchedule[]) => {
        triggerHaptic('medium');
        setIsSyncing(true);
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}/propose-apps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName, apps })
            });

            let data;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await response.json();
            } else {
                data = { error: await response.text() };
            }

            if (response.ok) {
                Alert.alert('Protocol Synced', 'Your app proposals have been shared with the group.');
                fetchGroupStatus();
                setShowAppPicker(false);
            } else if (response.status === 404) {
                handleMissingGroup();
            } else {
                Alert.alert('Sync Error', (data && data.error) || `Server returned ${response.status}`);
            }
        } catch (error: any) {
            Alert.alert('Network Error', `Could not reach Neural Hub: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const setMyTotalTime = async () => {
        const mins = Number(totalTimeInput);
        if (!Number.isFinite(mins) || mins <= 0) {
            Alert.alert('Invalid Time', 'Enter a valid total mobile time in minutes.');
            return;
        }

        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}/total-time`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName, totalMins: mins })
            });
            const data = await readApiBody(response);
            if (!response.ok) {
                if (response.status === 404) {
                    handleMissingGroup();
                    return;
                }
                const parsedError = String(data?.error || 'Could not update total time');
                const hint = parsedError.toLowerCase().includes('cannot post')
                    ? '\n\nBackend needs restart to load new routes.'
                    : '';
                Alert.alert('Update Error', `${parsedError}${hint}`);
                return;
            }

            setGroupData(data);
            setShowTotalTimeModal(false);
            setTotalTimeInput('');
        } catch (error: any) {
            Alert.alert('Network Error', error?.message || 'Could not set total time');
        }
    };

    const elapsedSeconds = groupData?.sessionStarted && groupData?.startTime
        ? Math.max(0, Math.floor((nowTs - groupData.startTime) / 1000))
        : 0;

    const formatRemaining = (seconds: number) => {
        const safe = Math.max(0, seconds);
        const mins = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const getMemberTotalMins = (member: any) => {
        const apps = Array.isArray(member?.selectedApps) ? member.selectedApps : [];
        return apps.reduce((sum: number, appItem: any) => {
            const mins = Number(typeof appItem === 'object' ? appItem?.durationMins : 10) || 0;
            return sum + Math.max(0, mins);
        }, 0);
    };

    return (
        isLoading && !groupData ? (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22D3EE" />
                <Text style={styles.loadingText}>SYNCING WITH NEURAL HUB...</Text>
            </View>
        ) : (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onExit} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>← EXIT</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>{groupData?.name.toUpperCase()}</Text>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    <View style={styles.codeCard}>
                        <Text style={styles.codeLabel}>ENTRY PROTOCOL CODE</Text>
                        <Text style={styles.codeValue}>{groupData?.code}</Text>
                        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                            <Text style={styles.shareBtnText}>SHARE INVITE</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>NEURAL NODES (MEMBERS)</Text>
                        <TouchableOpacity
                            style={styles.proposeBtn}
                            onPress={() => {
                                const myTotal = Number(currentUserMember?.totalMobileMins) || 0;
                                if (myTotal <= 0) {
                                    Alert.alert('Set Total Time First', 'Set your total mobile time in group before configuring apps.');
                                    return;
                                }
                                setShowAppPicker(true);
                            }}
                        >
                            <Text style={styles.proposeBtnText}>CHOOSE APPS</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.myTotalCard}>
                        <Text style={styles.myTotalLabel}>MY TOTAL MOBILE TIME</Text>
                        <Text style={styles.myTotalValue}>{Number(currentUserMember?.totalMobileMins) || 0}m</Text>
                        <TouchableOpacity style={styles.setTotalBtn} onPress={() => setShowTotalTimeModal(true)}>
                            <Text style={styles.setTotalBtnText}>SET / UPDATE TOTAL</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.memberList}>
                        {groupData?.members.map((member: any, index: number) => {
                            const memberName = String(member?.name || 'Unknown');
                            return (
                                <View key={member?.id || `${memberName}-${index}`} style={styles.memberRow}>
                                    <View style={styles.memberAvatar}>
                                        <Text style={styles.avatarText}>{memberName.charAt(0).toUpperCase() || '?'}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memberName}>{memberName} {memberName === userName ? '(YOU)' : ''}</Text>
                                        <Text style={styles.memberTotalText}>TOTAL: {Number(member?.totalMobileMins) || 0}m | ALLOCATED: {getMemberTotalMins(member)}m</Text>
                                        <Text style={styles.memberPenaltyText}>-POINTS: {Number(member?.negativePoints) || 0}</Text>
                                        <View style={styles.roleTag}>
                                            <Text style={[styles.roleText, member.role === 'Admin' ? styles.adminText : styles.buddyText]}>
                                                {member.role === 'Admin' ? 'ADMIN' : 'BUDDY'}
                                            </Text>
                                        </View>
                                        {member.selectedApps && member.selectedApps.length > 0 && (
                                            <View style={styles.proposedAppsList}>
                                                {member.selectedApps.map((appItem: any) => {
                                                    const pkg = typeof appItem === 'string'
                                                        ? appItem
                                                        : (typeof appItem?.packageName === 'string' ? appItem.packageName : '');
                                                    if (!pkg) {
                                                        return null;
                                                    }
                                                    const app = installedApps.find(a => a.packageName === pkg);
                                                    const appLabel = typeof appItem === 'object' && appItem?.appName
                                                        ? appItem.appName
                                                        : app?.label || pkg.split('.').pop() || 'App';
                                                    return (
                                                        <View key={pkg} style={styles.proposedAppTag}>
                                                            <Text style={styles.proposedAppText}>{appLabel}</Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.onlineStatus} />
                                </View>
                            );
                        })}
                    </View>

                    {groupData?.lastPenalty && (
                        <View style={styles.penaltyBanner}>
                            <Text style={styles.penaltyBannerText}>
                                LAST LOSS: {groupData.lastPenalty.offenderName} used +{groupData.lastPenalty.usedMins}m,
                                others total reduced.
                            </Text>
                        </View>
                    )}

                    <Text style={styles.sectionTitle}>COLLABORATIVE GOVERNANCE</Text>
                    <View style={styles.timerCard}>
                        {groupData?.members?.every((member: any) => !member.selectedApps || member.selectedApps.length === 0) ? (
                            <Text style={styles.emptyText}>NO APPS CHOSEN YET</Text>
                        ) : (
                            groupData?.members.map((member: any) => {
                                if (!member.selectedApps || member.selectedApps.length === 0) return null;

                                return (
                                    <View key={`member-timer-${member.id}`} style={styles.memberTimerBlock}>
                                        <View style={styles.memberTimerHeader}>
                                            <Text style={styles.memberTimerTitle}>{member.name} {member.name === userName ? '(YOU)' : ''}</Text>
                                            <Text style={styles.memberTotalInline}>TOTAL {Number(member?.totalMobileMins) || 0}m</Text>
                                        </View>
                                        {member.selectedApps.map((appItem: any) => {
                                            const pkg = typeof appItem === 'string'
                                                ? appItem
                                                : (typeof appItem?.packageName === 'string' ? appItem.packageName : '');
                                            if (!pkg) {
                                                return null;
                                            }
                                            const fallbackLabel = installedApps.find((a) => a.packageName === pkg)?.label || pkg.split('.').pop() || 'App';
                                            const appName = typeof appItem === 'object' && appItem?.appName ? appItem.appName : fallbackLabel;
                                            const durationMins = Number(typeof appItem === 'object' ? appItem?.durationMins : 10) || 10;
                                            const remainingSeconds = (durationMins * 60) - elapsedSeconds;
                                            const isTotalLocked = (Number(member?.totalMobileMins) || 0) <= 0;
                                            const isLocked = Boolean(isTotalLocked || durationMins <= 0 || (groupData?.sessionStarted && remainingSeconds <= 0));

                                            return (
                                                <View key={`${member.id}-${pkg}`} style={styles.timerRow}>
                                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                                        <Text style={styles.appNameDisplay}>{appName}</Text>
                                                        <Text style={styles.appPkgText}>{pkg}</Text>
                                                    </View>
                                                    <View style={styles.timerRightCol}>
                                                        <Text style={[styles.durationMins, isLocked && styles.lockedTimeText]}>
                                                            {isTotalLocked ? '00:00' : (groupData?.sessionStarted ? formatRemaining(remainingSeconds) : `${durationMins}m`)}
                                                        </Text>
                                                        <Text style={[styles.lockStateText, isLocked ? styles.lockedState : styles.activeState]}>
                                                            {isLocked ? 'LOCKED' : 'ACTIVE'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                );
                            })
                        )}
                    </View>

                </ScrollView>

                <Modal visible={showAppPicker} animationType="slide" presentationStyle="fullScreen">
                    <DigitalGovernanceScreen
                        onBack={() => setShowAppPicker(false)}
                        isSyncing={isSyncing}
                        maxTotalMins={Number(currentUserMember?.totalMobileMins) || 0}
                        initialSchedules={Array.isArray(currentUserMember?.selectedApps)
                            ? currentUserMember.selectedApps.map((app: any) => ({
                                id: app.packageName,
                                name: app.appName,
                                durationMins: Number(app.durationMins) || 0,
                            }))
                            : []}
                        onPropose={(apps: AppSchedule[]) => {
                            proposeApps(apps);
                        }}
                    />
                </Modal>

                <Modal visible={showTotalTimeModal} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.totalTimePanel}>
                            <Text style={styles.totalTitle}>SET TOTAL MOBILE TIME</Text>
                            <TextInput
                                style={styles.totalInput}
                                keyboardType="numeric"
                                placeholder="Enter minutes (e.g. 180)"
                                placeholderTextColor="#64748B"
                                value={totalTimeInput}
                                onChangeText={setTotalTimeInput}
                            />
                            <View style={styles.totalButtonsRow}>
                                <TouchableOpacity style={styles.totalCancelBtn} onPress={() => setShowTotalTimeModal(false)}>
                                    <Text style={styles.totalCancelText}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.totalSaveBtn} onPress={setMyTotalTime}>
                                    <Text style={styles.totalSaveText}>SAVE</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </SafeAreaView>
        )
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F1115' },
    loadingContainer: { flex: 1, backgroundColor: '#0F1115', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#22D3EE', marginTop: 20, letterSpacing: 2, fontSize: 12, fontWeight: '800' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    backBtn: { padding: 8 },
    backBtnText: { color: '#94A3B8', fontWeight: '800', fontSize: 12 },
    title: { color: '#F8FAFC', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
    scroll: { padding: 20 },
    codeCard: { backgroundColor: '#1E293B', padding: 24, borderRadius: 24, alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#334155' },
    codeLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
    codeValue: { color: '#22D3EE', fontSize: 42, fontWeight: '900', letterSpacing: 8, marginBottom: 16 },
    shareBtn: { backgroundColor: '#334155', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    shareBtnText: { color: '#F8FAFC', fontSize: 10, fontWeight: '800' },
    sectionTitle: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
    myTotalCard: { backgroundColor: '#121C2A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, marginBottom: 16 },
    myTotalLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    myTotalValue: { color: '#22D3EE', fontSize: 20, fontWeight: '900', marginTop: 4 },
    setTotalBtn: { marginTop: 10, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    setTotalBtnText: { color: '#E2E8F0', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
    memberList: { marginBottom: 32 },
    memberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#161B22', padding: 12, borderRadius: 16 },
    memberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { color: '#E2E8F0', fontWeight: '800' },
    memberName: { color: '#F1F5F9', fontWeight: '600', flex: 1 },
    memberTotalText: { color: '#22D3EE', fontSize: 10, fontWeight: '800', marginTop: 3 },
    memberPenaltyText: { color: '#FCA5A5', fontSize: 10, fontWeight: '800', marginTop: 3 },
    onlineStatus: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', shadowColor: '#10B981', shadowRadius: 4, shadowOpacity: 1 },
    penaltyBanner: { backgroundColor: '#1E1B26', borderWidth: 1, borderColor: '#4C1D95', borderRadius: 10, padding: 10, marginBottom: 16 },
    penaltyBannerText: { color: '#C4B5FD', fontSize: 11, fontWeight: '700' },
    timerCard: { backgroundColor: '#161B22', padding: 20, borderRadius: 20, marginBottom: 16 },
    emptyText: { color: '#475569', textAlign: 'center', fontStyle: 'italic', fontSize: 12 },
    timerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    memberTimerBlock: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 12 },
    memberTimerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    memberTimerTitle: { color: '#E2E8F0', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
    memberTotalInline: { color: '#22D3EE', fontSize: 10, fontWeight: '800' },
    appName: { color: '#F8FAFC', fontWeight: '700' },
    durationMins: { color: '#22D3EE', fontWeight: '800', fontFamily: 'monospace' },
    appPkgText: { color: '#64748B', fontSize: 10, marginTop: 2 },
    timerRightCol: { alignItems: 'flex-end' },
    lockStateText: { fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
    activeState: { color: '#10B981' },
    lockedState: { color: '#F43F5E' },
    lockedTimeText: { color: '#F43F5E' },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    proposeBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#475569' },
    proposeBtnText: { color: '#F8FAFC', fontSize: 10, fontWeight: '800' },
    roleTag: { marginTop: 4 },
    roleText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
    adminText: { color: '#F43F5E' },
    buddyText: { color: '#10B981' },
    appNameDisplay: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    pickerPanel: { backgroundColor: '#161B22', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: '#334155' },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    proposedAppsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
    proposedAppTag: { backgroundColor: '#1E293B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#334155' },
    proposedAppText: { color: '#94A3B8', fontSize: 8, fontWeight: '700' },
    pickerTitle: { fontSize: 13, fontWeight: '900', color: '#F8FAFC', letterSpacing: 1.5 },
    closeText: { fontSize: 12, color: '#94A3B8', fontWeight: '800' },
    appOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    appOptionText: { color: '#F1F5F9', fontWeight: '700', fontSize: 14 },
    appOptionPkg: { color: '#475569', fontSize: 10, marginTop: 2 },
    totalTimePanel: { backgroundColor: '#161B22', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
    totalTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
    totalInput: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
    totalButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
    totalCancelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B' },
    totalCancelText: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
    totalSaveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2563EB' },
    totalSaveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});
