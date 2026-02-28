import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
    Animated, Modal, Platform, Alert, Easing, Vibration, ActivityIndicator,
    TextInput, Image, FlatList, Share
} from 'react-native';
import { API_CONFIG } from '../config/apiConfig';
import FocusModeScreen from './FocusModeScreen';
import DigitalGovernanceScreen, { AppSchedule } from './DigitalGovernanceScreen';

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
    const [pulseAnim] = useState(new Animated.Value(1));
    const [showAppPicker, setShowAppPicker] = useState(false);
    const [installedApps, setInstalledApps] = useState<any[]>([]);
    const [isFocusActive, setIsFocusActive] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const currentUserMember = groupData?.members.find((m: any) => m.name === userName);
    const isAdmin = groupData?.createdBy === userName || currentUserMember?.role === 'Admin';

    useEffect(() => {
        fetchGroupStatus();
        fetchInstalledApps();
        const interval = setInterval(fetchGroupStatus, 3000); // Poll faster for sync
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (groupData?.sessionStarted && !isFocusActive) {
            setIsFocusActive(true);
            triggerHaptic('heavy');
        }
    }, [groupData?.sessionStarted]);

    const fetchInstalledApps = async () => {
        try {
            const { InstalledApps } = require('react-native-launcher-kit');
            const apps = await InstalledApps.getSortedApps();
            setInstalledApps(apps);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchGroupStatus = async () => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}`);
            const data = await response.json();
            if (response.ok) {
                setGroupData(data);
            }
        } catch (error) {
            console.error('Failed to sync group state:', error);
        } finally {
            setIsLoading(false);
        }
    };

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

    const proposeApps = async (apps: string[]) => {
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
            } else {
                Alert.alert('Sync Error', (data && data.error) || `Server returned ${response.status}`);
            }
        } catch (error: any) {
            Alert.alert('Network Error', `Could not reach Neural Hub: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const setAppTimer = async (packageName: string, appName: string, mins: number) => {
        if (!isAdmin) return;
        triggerHaptic('light');
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}/timer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageName, appName, durationMins: mins, userName })
            });
            if (response.ok) fetchGroupStatus();
            else {
                const err = await response.json();
                Alert.alert('Permission Error', err.error);
            }
        } catch (error) {
            Alert.alert('Sync Error', 'Failed to update collaborative timer.');
        }
    };

    const initiateFocus = async () => {
        if (!isAdmin) return;
        triggerHaptic('heavy');
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName })
            });
            if (response.ok) fetchGroupStatus();
            else {
                const err = await response.json();
                Alert.alert('Permission Error', err.error);
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (isFocusActive && groupData) {
        return (
            <FocusModeScreen
                durationMinutes={groupData.activeTimers[0]?.durationMins || 25}
                participants={groupData.members.map((m: any) => m.name)}
                onEndFocus={() => {
                    setIsFocusActive(false);
                    onExit();
                }}
            />
        );
    }

    if (isLoading && !groupData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22D3EE" />
                <Text style={styles.loadingText}>SYNCING WITH NEURAL HUB...</Text>
            </View>
        );
    }

    return (
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
                    <TouchableOpacity style={styles.proposeBtn} onPress={() => setShowAppPicker(true)}>
                        <Text style={styles.proposeBtnText}>CHOOSE APPS</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.memberList}>
                    {groupData?.members.map((member: any) => (
                        <View key={member.id} style={styles.memberRow}>
                            <View style={styles.memberAvatar}>
                                <Text style={styles.avatarText}>{member.name[0].toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.memberName}>{member.name} {member.name === userName ? '(YOU)' : ''}</Text>
                                <View style={styles.roleTag}>
                                    <Text style={[styles.roleText, member.role === 'Admin' ? styles.adminText : styles.buddyText]}>
                                        {member.role === 'Admin' ? 'ADMIN' : 'BUDDY'}
                                    </Text>
                                </View>
                                {member.selectedApps && member.selectedApps.length > 0 && (
                                    <View style={styles.proposedAppsList}>
                                        {member.selectedApps.map((pkg: string) => {
                                            const app = installedApps.find(a => a.packageName === pkg);
                                            return (
                                                <View key={pkg} style={styles.proposedAppTag}>
                                                    <Text style={styles.proposedAppText}>{app?.label || pkg.split('.').pop()}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                            <View style={styles.onlineStatus} />
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>COLLABORATIVE GOVERNANCE</Text>
                <View style={styles.timerCard}>
                    {groupData?.activeTimers.length === 0 ? (
                        <Text style={styles.emptyText}>NO TIMERS PROPOSED YET</Text>
                    ) : (
                        groupData.activeTimers.map((timer: any) => (
                            <View key={timer.packageName} style={styles.timerRow}>
                                <Text style={styles.appNameDisplay}>{timer.appName}</Text>
                                <Text style={styles.durationMins}>{timer.durationMins}m</Text>
                            </View>
                        ))
                    )}
                </View>

                {isAdmin && (
                    <>
                        <Text style={styles.sectionSubtitle}>SET SESSION CAPACITY</Text>
                        <View style={styles.pillsRow}>
                            {[20, 45, 60, 120, 240].map(mins => (
                                <TouchableOpacity
                                    key={mins}
                                    style={styles.pill}
                                    onPress={() => setAppTimer('sync.all', 'GROUP FOCUS', mins)}
                                >
                                    <Text style={styles.pillText}>{mins >= 60 ? `${mins / 60}H` : `${mins}M`}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.startBtn}
                            onPress={initiateFocus}
                            activeOpacity={0.8}
                        >
                            <View style={styles.startBtnInner}>
                                <Text style={styles.startBtnText}>
                                    {groupData?.sessionStarted ? 'SESSION ACTIVE' : 'INITIATE SYNCED FOCUS'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            <Modal visible={showAppPicker} animationType="slide" presentationStyle="fullScreen">
                <DigitalGovernanceScreen
                    onBack={() => setShowAppPicker(false)}
                    isSyncing={isSyncing}
                    onPropose={(apps: AppSchedule[]) => {
                        const packageNames = apps.map(a => a.id);
                        proposeApps(packageNames);
                    }}
                />
            </Modal>
        </SafeAreaView>
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
    memberList: { marginBottom: 32 },
    memberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#161B22', padding: 12, borderRadius: 16 },
    memberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { color: '#E2E8F0', fontWeight: '800' },
    memberName: { color: '#F1F5F9', fontWeight: '600', flex: 1 },
    onlineStatus: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', shadowColor: '#10B981', shadowRadius: 4, shadowOpacity: 1 },
    timerCard: { backgroundColor: '#161B22', padding: 20, borderRadius: 20, marginBottom: 16 },
    emptyText: { color: '#475569', textAlign: 'center', fontStyle: 'italic', fontSize: 12 },
    timerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    appName: { color: '#F8FAFC', fontWeight: '700' },
    durationMins: { color: '#22D3EE', fontWeight: '800', fontFamily: 'monospace' },
    pillsRow: { flexDirection: 'row', gap: 8, marginBottom: 40, flexWrap: 'wrap' },
    pill: { backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
    pillText: { color: '#38BDF8', fontWeight: '800', fontSize: 12 },
    startBtn: { height: 60, borderRadius: 20, overflow: 'hidden' },
    startBtnInner: { flex: 1, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
    startBtnText: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 2, fontSize: 14 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    proposeBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#475569' },
    proposeBtnText: { color: '#F8FAFC', fontSize: 10, fontWeight: '800' },
    roleTag: { marginTop: 4 },
    roleText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
    adminText: { color: '#F43F5E' },
    buddyText: { color: '#10B981' },
    appNameDisplay: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
    sectionSubtitle: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16, marginTop: 24 },
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
});
