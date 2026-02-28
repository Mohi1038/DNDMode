import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
    Animated, Modal, Platform, Alert, Easing, Vibration, ActivityIndicator,
    TextInput, Image, FlatList
} from 'react-native';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { InstalledApps } from 'react-native-launcher-kit';
import { triggerHaptic } from '../utils/haptics';

export interface AppSchedule {
    id: string;
    name: string;
    icon: string;
    start: string;
    end: string;
    duration: number;
    color: string;
    isNative: boolean;
}

export default function DigitalGovernanceScreen({ onBack, onPropose, isSyncing }: { onBack: () => void, onPropose?: (apps: any[]) => void, isSyncing?: boolean }) {
    const [appSchedules, setAppSchedules] = useState<AppSchedule[]>([]);
    const [filteredApps, setFilteredApps] = useState<AppSchedule[]>([]);
    const [allDeviceApps, setAllDeviceApps] = useState<AppSchedule[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingApps, setIsLoadingApps] = useState(true);
    const [showExpansionModal, setShowExpansionModal] = useState(false);
    const [expansionSearch, setExpansionSearch] = useState('');

    // Time Picker UI State
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [activeAppId, setActiveAppId] = useState<string | null>(null);
    const [activeTimeType, setActiveTimeType] = useState<'start' | 'end' | null>(null);
    const [selectedHH, setSelectedHH] = useState('12');
    const [selectedMM, setSelectedMM] = useState('00');

    // Animations
    const entranceAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(entranceAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        fetchAppProtocols();
    }, []);

    const fetchAppProtocols = async () => {
        setIsLoadingApps(true);
        try {
            const apps = await InstalledApps.getSortedApps({
                includeAccentColor: true,
                includeVersion: false
            });

            const formattedApps: AppSchedule[] = apps.map(app => {
                let cleanIcon = app.icon;
                if (cleanIcon && cleanIcon.startsWith('file://')) {
                    // OK
                } else if (cleanIcon && cleanIcon.length > 50) {
                    const sanitized = cleanIcon.replace(/\s/g, '');
                    const base64 = sanitized.includes('base64,') ? sanitized.split('base64,')[1] : sanitized;
                    cleanIcon = `data:image/png;base64,${base64}`;
                } else {
                    cleanIcon = '';
                }

                return {
                    id: app.packageName,
                    name: app.label || 'Unknown Interface',
                    icon: cleanIcon,
                    start: '09:00',
                    end: '17:00',
                    duration: 8,
                    color: app.accentColor || '#38BDF8',
                    isNative: true
                };
            });

            setAllDeviceApps(formattedApps);

            const socialKeywords = ['facebook', 'instagram', 'whatsapp', 'twitter', 'x.com', 'discord', 'telegram', 'snapchat', 'tiktok', 'reddit'];
            const gameKeywords = ['game', 'atari', 'unity', 'unreal', 'mojang', 'roblox', 'tencent', 'pubg', 'chess'];

            const initialSchedules = formattedApps.filter(app => {
                const pkg = app.id.toLowerCase();
                const name = app.name.toLowerCase();
                const isSocial = socialKeywords.some(kw => pkg.includes(kw) || name.includes(kw));
                const isGame = gameKeywords.some(kw => pkg.includes(kw) || name.includes(kw));
                return isSocial || isGame;
            });

            setAppSchedules(initialSchedules);
            setFilteredApps(initialSchedules);
        } catch (error) {
            console.error('Failed to fetch native apps:', error);
        } finally {
            setIsLoadingApps(false);
        }
    };

    const addAppToGovernance = (app: AppSchedule) => {
        if (appSchedules.some(a => a.id === app.id)) {
            Alert.alert('System Alert', 'This interface is already under governance.');
            return;
        }
        const updated = [...appSchedules, app];
        setAppSchedules(updated);
        setFilteredApps(updated);
        setShowExpansionModal(false);
        triggerHaptic('medium');
    };

    const updateAppDuration = (id: string, hours: number) => {
        setAppSchedules(prev => prev.map(app => {
            if (app.id === id) {
                const [h, m] = app.start.split(':').map(Number);
                const endH = (h + hours) % 24;
                const endStr = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                return { ...app, duration: hours, end: endStr };
            }
            return app;
        }));
    };

    useEffect(() => {
        const filtered = appSchedules.filter(app =>
            app.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredApps(filtered);
    }, [searchQuery, appSchedules]);

    const getCategorizedData = () => {
        const socialApps = filteredApps.filter(app => {
            const pkg = app.id.toLowerCase();
            const name = app.name.toLowerCase();
            const socialKeywords = ['facebook', 'instagram', 'whatsapp', 'twitter', 'x.com', 'discord', 'telegram', 'snapchat', 'tiktok', 'reddit'];
            return socialKeywords.some(kw => pkg.includes(kw) || name.includes(kw));
        });

        const gameApps = filteredApps.filter(app => {
            const pkg = app.id.toLowerCase();
            const name = app.name.toLowerCase();
            const gameKeywords = ['game', 'atari', 'unity', 'unreal', 'mojang', 'roblox', 'tencent', 'pubg', 'chess'];
            return gameKeywords.some(kw => pkg.includes(kw) || name.includes(kw)) && !socialApps.some(s => s.id === app.id);
        });

        const otherApps = filteredApps.filter(app => !socialApps.some(s => s.id === app.id) && !gameApps.some(g => g.id === app.id));

        const data: any[] = [];
        if (socialApps.length > 0) {
            data.push({ isHeader: true, title: 'SOCIAL MEDIA', color: '#E1306C' });
            socialApps.forEach(a => data.push({ ...a, isHeader: false }));
        }
        if (gameApps.length > 0) {
            data.push({ isHeader: true, title: 'GAMES', color: '#10B981' });
            gameApps.forEach(a => data.push({ ...a, isHeader: false }));
        }
        if (otherApps.length > 0) {
            data.push({ isHeader: true, title: 'OTHER GOVERNANCE PATHS', color: '#6366F1' });
            otherApps.forEach(a => data.push({ ...a, isHeader: false }));
        }
        return data;
    };

    const openTimePicker = (appId: string, type: 'start' | 'end', currentVal: string) => {
        const [hh, mm] = currentVal.split(':');
        setActiveAppId(appId);
        setActiveTimeType(type);
        setSelectedHH(hh);
        setSelectedMM(mm);
        setIsTimePickerVisible(true);
        triggerHaptic('light');
    };

    const confirmTime = () => {
        if (!activeAppId || !activeTimeType) return;
        const newTime = `${selectedHH}:${selectedMM}`;
        setAppSchedules(prev => prev.map(app => {
            if (app.id === activeAppId) {
                return { ...app, [activeTimeType]: newTime };
            }
            return app;
        }));
        setFilteredApps(prev => prev.map(app => {
            if (app.id === activeAppId) {
                return { ...app, [activeTimeType]: newTime };
            }
            return app;
        }));
        setIsTimePickerVisible(false);
        triggerHaptic('medium');
    };

    const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const opacity = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

    return (
        <View style={styles.masterContainer}>
            <View style={[styles.bgLayer, { backgroundColor: '#0F1115' }]} />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { triggerHaptic('light'); onBack(); }} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← BACK</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>CONFIGURE APPS</Text>
                </View>

                <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>
                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchIconBox}>
                            <Text style={styles.searchIcon}>🔍</Text>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="SEARCH NEURAL SIGNATURES"
                            placeholderTextColor="#475569"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                        />
                    </View>

                    {isLoadingApps ? (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="large" color="#22D3EE" />
                            <Text style={styles.loaderText}>SYNCING NEURAL PATHS...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={getCategorizedData()}
                            keyExtractor={(item, index) => item.isHeader ? `header-${index}` : item.id}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            renderItem={({ item }) => {
                                if (item.isHeader) {
                                    return (
                                        <View style={styles.sectionHeader}>
                                            <View style={[styles.headerLine, { backgroundColor: item.color }]} />
                                            <Text style={[styles.sectionHeaderText, { color: item.color }]}>{item.title}</Text>
                                        </View>
                                    );
                                }
                                const app = item;
                                return (
                                    <View style={styles.appRow}>
                                        <View style={styles.rowTop}>
                                            <View style={styles.appInfo}>
                                                <View style={[styles.appIconContainer, { borderColor: app.color }]}>
                                                    {app.icon ? (
                                                        <Image source={{ uri: app.icon }} style={styles.nativeAppIcon} resizeMode="cover" />
                                                    ) : (
                                                        <Text style={{ fontSize: 18 }}>📱</Text>
                                                    )}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                                                    <Text style={styles.appStatus} numberOfLines={1}>{app.id}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.timePickerContainer}>
                                                <View style={styles.timePickerCol}>
                                                    <Text style={styles.timeSmallLabel}>START</Text>
                                                    <TouchableOpacity style={styles.timeValueBox} onPress={() => openTimePicker(app.id, 'start', app.start)}>
                                                        <Text style={styles.timeValueText}>{app.start}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={styles.timeSeparator}>→</Text>
                                                <View style={styles.timePickerCol}>
                                                    <Text style={styles.timeSmallLabel}>END</Text>
                                                    <TouchableOpacity style={styles.timeValueBox} onPress={() => openTimePicker(app.id, 'end', app.end)}>
                                                        <Text style={styles.timeValueText}>{app.end}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.durationContainer}>
                                            <Text style={styles.durationLabel}>DAILY CAPACITY: {app.duration || 0}H</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.durationScroll}>
                                                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24].map(hours => (
                                                    <TouchableOpacity
                                                        key={hours}
                                                        onPress={() => { triggerHaptic('light'); updateAppDuration(app.id, hours); }}
                                                        style={[
                                                            styles.durationStep,
                                                            app.duration === hours && { backgroundColor: app.color + '22', borderColor: app.color, borderWidth: 1.5 }
                                                        ]}
                                                    >
                                                        <Text style={[styles.durationStepText, app.duration === hours && { color: app.color, fontWeight: '800' }]}>{hours}h</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    </View>
                                );
                            }}
                        />
                    )}
                </Animated.View>

                {/* Floating Action Button for Expansion */}
                {!isLoadingApps && (
                    <View style={styles.fabContainer}>
                        {onPropose && (
                            <TouchableOpacity
                                style={[styles.fab, { backgroundColor: '#10B981', marginRight: 10, flex: 1, position: 'relative', bottom: 0, right: 0 }]}
                                onPress={() => { triggerHaptic('heavy'); onPropose(appSchedules); }}
                                disabled={isSyncing}
                            >
                                {isSyncing ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.fabText}>PROPOSE TO GROUP</Text>
                                )}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.fab, { flex: 1, position: 'relative', bottom: 0, right: 0 }]}
                            onPress={() => { triggerHaptic('medium'); setShowExpansionModal(true); }}
                        >
                            <Text style={styles.fabText}>+ ADD NEW APPS</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Time Picker Modal */}
                <Modal visible={isTimePickerVisible} transparent animationType="slide">
                    <View style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}>
                        <View style={styles.pickerPanel}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>SELECT TEMPORAL MARK</Text>
                                <TouchableOpacity onPress={() => setIsTimePickerVisible(false)}>
                                    <Text style={styles.closeText}>CANCEL</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.pickerWheelLayout}>
                                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false} pagingEnabled snapToInterval={40}>
                                    {Array.from({ length: 24 }).map((_, i) => {
                                        const val = i.toString().padStart(2, '0');
                                        const isActive = selectedHH === val;
                                        return (
                                            <TouchableOpacity key={i} style={styles.pickerItem} onPress={() => { triggerHaptic('light'); setSelectedHH(val); }}>
                                                <Text style={[styles.pickerItemText, isActive && styles.pickerItemTextActive]}>{val}</Text>
                                                {isActive && <View style={styles.pickerItemGlow} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                                <Text style={styles.pickerDivider}>:</Text>
                                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false} pagingEnabled snapToInterval={40}>
                                    {['00', '15', '30', '45'].map(val => {
                                        const isActive = selectedMM === val;
                                        return (
                                            <TouchableOpacity key={val} style={styles.pickerItem} onPress={() => { triggerHaptic('light'); setSelectedMM(val); }}>
                                                <Text style={[styles.pickerItemText, isActive && styles.pickerItemTextActive]}>{val}</Text>
                                                {isActive && <View style={styles.pickerItemGlow} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                            <TouchableOpacity style={styles.confirmButton} onPress={confirmTime}>
                                <Text style={styles.confirmButtonText}>CONFIRM PROTOCOL</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Neural Expansion Modal */}
                <Modal visible={showExpansionModal} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.pickerPanel}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>ADD NEW APPS</Text>
                                <TouchableOpacity onPress={() => setShowExpansionModal(false)}>
                                    <Text style={styles.closeText}>CANCEL</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.searchContainer}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="FILTER DEVICE PATHS"
                                    placeholderTextColor="#475569"
                                    value={expansionSearch}
                                    onChangeText={setExpansionSearch}
                                />
                            </View>
                            <FlatList
                                data={allDeviceApps.filter(app => app.name.toLowerCase().includes(expansionSearch.toLowerCase()))}
                                keyExtractor={item => item.id}
                                style={{ maxHeight: 400 }}
                                renderItem={({ item: app }) => (
                                    <TouchableOpacity style={styles.searchAppRow} onPress={() => addAppToGovernance(app)}>
                                        <View style={[styles.appIconContainer, { borderColor: app.color, width: 32, height: 32, marginRight: 12 }]}>
                                            {app.icon ? <Image source={{ uri: app.icon }} style={{ width: '100%', height: '100%' }} /> : <Text>📱</Text>}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.appName}>{app.name}</Text>
                                            <Text style={styles.appStatus}>{app.id}</Text>
                                        </View>
                                        <Text style={{ color: '#22D3EE', fontSize: 20 }}>+</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    masterContainer: { flex: 1, backgroundColor: '#0F1115' },
    bgLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: '#161B22'
    },
    backButton: { marginRight: 20 },
    backButtonText: { color: '#94A3B8', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', letterSpacing: 1.5 },
    content: { flex: 1, padding: 20 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 16,
        paddingHorizontal: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 20, height: 50
    },
    searchIconBox: { marginRight: 12 },
    searchIcon: { fontSize: 16 },
    searchInput: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { color: '#94A3B8', marginTop: 16, fontWeight: '700', letterSpacing: 1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16, gap: 12 },
    headerLine: { width: 4, height: 18, borderRadius: 2 },
    sectionHeaderText: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
    appRow: { backgroundColor: '#161B22', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    appInfo: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
    appIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#0F172A', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    nativeAppIcon: { width: '100%', height: '100%' },
    appName: { fontSize: 16, fontWeight: '800', color: '#F1F5F9' },
    appStatus: { fontSize: 11, color: '#64748B', marginTop: 2 },
    timePickerContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timePickerCol: { alignItems: 'center', gap: 4 },
    timeSmallLabel: { fontSize: 8, fontWeight: '900', color: '#475569' },
    timeValueBox: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
    timeValueText: { fontSize: 13, fontWeight: '700', color: '#22D3EE', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    timeSeparator: { color: '#334155', marginTop: 16 },
    durationContainer: { marginTop: 20 },
    durationLabel: { fontSize: 10, fontWeight: '800', color: '#475569', marginBottom: 12, letterSpacing: 1 },
    durationScroll: { flexDirection: 'row' },
    durationStep: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#1E293B', marginRight: 10, backgroundColor: '#0F172A' },
    durationStepText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    fab: {
        position: 'absolute', bottom: 30, right: 20, backgroundColor: '#2563EB',
        paddingHorizontal: 24, paddingVertical: 16, borderRadius: 30,
        shadowColor: '#2563EB', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15
    },
    fabText: { color: '#FFF', fontWeight: '900', letterSpacing: 1, fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    pickerPanel: { backgroundColor: '#161B22', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: '#334155' },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    pickerTitle: { fontSize: 13, fontWeight: '900', color: '#F8FAFC', letterSpacing: 1.5 },
    closeText: { fontSize: 12, color: '#94A3B8', fontWeight: '800' },
    pickerWheelLayout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 200, marginBottom: 30 },
    pickerColumn: { width: 80 },
    pickerItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
    pickerItemText: { fontSize: 24, fontWeight: '600', color: '#475569' },
    pickerItemTextActive: { fontSize: 28, fontWeight: '900', color: '#22D3EE' },
    pickerDivider: { fontSize: 32, fontWeight: '900', color: '#334155', marginHorizontal: 20 },
    pickerItemGlow: { position: 'absolute', width: '100%', height: 2, bottom: 0, backgroundColor: '#22D3EE', opacity: 0.4 },
    confirmButton: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 20, alignItems: 'center' },
    confirmButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    searchAppRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    fabContainer: {
        position: 'absolute', bottom: 30, left: 20, right: 20,
        flexDirection: 'row', alignItems: 'center', gap: 10
    }
});
