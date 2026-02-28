import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
    Animated, Modal, Platform, Alert, Easing, ActivityIndicator,
    TextInput, Image, FlatList, NativeModules
} from 'react-native';
import { triggerHaptic } from '../utils/haptics';
import { setAppTimer, removeAppTimer, startTimerService, hasUsagePermission, openUsageAccessSettings } from '../services/AppTimerService';

const { InstalledAppsModule } = NativeModules;

const FONT_FAMILY_REGULAR = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const FONT_FAMILY_MEDIUM = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });
const FONT_FAMILY_BOLD = Platform.select({ ios: 'System', android: 'sans-serif-bold', default: 'System' });

export interface AppSelection {
    id: string;
    name: string;
    icon: string;
    color: string;
    isNative: boolean;
    selected: boolean;
    durationMins?: number;
}

export interface AppSchedule {
    id: string;
    name: string;
    durationMins: number;
}

export default function DigitalGovernanceScreen({
    onBack,
    onConfirmSelection,
    onPropose,
    isSyncing = false,
    maxTotalMins,
    initialSchedules = [],
}: {
    onBack: () => void;
    onConfirmSelection?: (apps: AppSchedule[]) => void;
    onPropose?: (apps: AppSchedule[]) => void;
    isSyncing?: boolean;
    maxTotalMins?: number;
    initialSchedules?: AppSchedule[];
}) {
    const [appCatalog, setAppCatalog] = useState<AppSelection[]>([]);
    const [filteredApps, setFilteredApps] = useState<AppSelection[]>([]);
    const [allDeviceApps, setAllDeviceApps] = useState<AppSelection[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingApps, setIsLoadingApps] = useState(true);
    const [showExpansionModal, setShowExpansionModal] = useState(false);
    const [expansionSearch, setExpansionSearch] = useState('');
    const [isSettingTimers, setIsSettingTimers] = useState(false);

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
            if (!InstalledAppsModule?.getSortedApps) {
                console.warn('InstalledAppsModule native module not available');
                setAllDeviceApps([]);
                setAppCatalog([]);
                setFilteredApps([]);
                return;
            }

            const apps = await InstalledAppsModule.getSortedApps();

            const formattedApps: AppSelection[] = apps.map((app: any) => {
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
                    color: app.accentColor || '#38BDF8',
                    isNative: true,
                    selected: false,
                    durationMins: 15,
                };
            });

            setAllDeviceApps(formattedApps);

            const socialKeywords = ['facebook', 'instagram', 'whatsapp', 'twitter', 'x.com', 'discord', 'telegram', 'snapchat', 'tiktok', 'reddit'];
            const gameKeywords = ['game', 'atari', 'unity', 'unreal', 'mojang', 'roblox', 'tencent', 'pubg', 'chess'];

            const initialSelection = formattedApps
                .filter(app => {
                    const pkg = app.id.toLowerCase();
                    const name = app.name.toLowerCase();
                    const isSocial = socialKeywords.some(kw => pkg.includes(kw) || name.includes(kw));
                    const isGame = gameKeywords.some(kw => pkg.includes(kw) || name.includes(kw));
                    return isSocial || isGame;
                })
                .map(app => ({ ...app, selected: true }));

            setAppCatalog(initialSelection);
            setFilteredApps(initialSelection);
        } catch (error) {
            console.error('Failed to fetch native apps:', error);
        } finally {
            setIsLoadingApps(false);
        }
    };

    const selectedTotalMins = appCatalog
        .filter(app => app.selected)
        .reduce((sum, app) => sum + (app.durationMins || 15), 0);

    const remainingMins = maxTotalMins !== undefined
        ? Math.max(0, maxTotalMins - selectedTotalMins)
        : null;

    const addAppToGovernance = (app: AppSelection) => {
        if (appCatalog.some(a => a.id === app.id)) {
            Alert.alert('System Alert', 'This interface is already listed.');
            return;
        }

        if (maxTotalMins !== undefined && (selectedTotalMins + 15) > maxTotalMins) {
            Alert.alert('Limit Reached', `You cannot exceed your total mobile time (${maxTotalMins}m).`);
            return;
        }

        const updated = [...appCatalog, { ...app, selected: true }];
        setAppCatalog(updated);
        setFilteredApps(updated);
        setShowExpansionModal(false);
        triggerHaptic('medium');
    };

    const toggleAppSelection = (id: string) => {
        triggerHaptic('light');
        setAppCatalog(prev => prev.map(app => {
            if (app.id !== id) {
                return app;
            }

            const willSelect = !app.selected;
            if (willSelect && maxTotalMins !== undefined) {
                const currentTotal = prev.filter(a => a.selected).reduce((sum, a) => sum + (a.durationMins || 15), 0);
                const currentAppDuration = app.durationMins || 15;
                if ((currentTotal + currentAppDuration) > maxTotalMins) {
                    Alert.alert('Limit Reached', `Total app time cannot exceed ${maxTotalMins}m.`);
                    return app;
                }
            }

            return {
                ...app,
                selected: willSelect,
                durationMins: willSelect ? (app.durationMins || 15) : undefined,
            };
        }));
    };

    const setAppDuration = (id: string, durationMins: number) => {
        triggerHaptic('light');
        setAppCatalog(prev => {
            const currentTotal = prev.filter(app => app.selected).reduce((sum, app) => sum + (app.durationMins || 15), 0);
            const currentApp = prev.find(app => app.id === id);
            const currentDuration = currentApp?.durationMins || 15;
            const nextTotal = currentTotal - currentDuration + durationMins;

            if (maxTotalMins !== undefined && nextTotal > maxTotalMins) {
                Alert.alert('Limit Reached', `Total app time cannot exceed ${maxTotalMins}m.`);
                return prev;
            }

            return prev.map(app => (
                app.id === id ? { ...app, durationMins } : app
            ));
        });
    };

    useEffect(() => {
        const filtered = appCatalog.filter(app =>
            app.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredApps(filtered);
    }, [searchQuery, appCatalog]);

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

    const applyTimers = async (selected: AppSchedule[]) => {
        try {
            for (const app of selected) {
                await setAppTimer(app.id, app.durationMins);
            }

            // Remove timers for unselected apps
            const unselected = appCatalog.filter(app => !app.selected);
            for (const app of unselected) {
                try {
                    await removeAppTimer(app.id);
                } catch (_) {
                    // Ignore if timer didn't exist
                }
            }

            // Start the monitoring service
            await startTimerService();
        } catch (error) {
            console.error('Failed to set app timers:', error);
            setIsSettingTimers(false);
            Alert.alert('Timer Error', 'Failed to configure app timers. Please try again.');
            return;
        }

        setIsSettingTimers(false);
        onConfirmSelection?.(selected);
        onPropose?.(selected);
        onBack();
    };

    const handleConfirmConfiguration = async () => {
        const selected: AppSchedule[] = appCatalog
            .filter(app => app.selected)
            .map(app => ({
                id: app.id,
                name: app.name,
                durationMins: app.durationMins || 15,
            }));

        if (selected.length === 0) {
            Alert.alert('No apps selected', 'Select at least one app to align with focus timer.');
            return;
        }

        if (maxTotalMins !== undefined) {
            const allocated = selected.reduce((sum, app) => sum + app.durationMins, 0);
            if (allocated > maxTotalMins) {
                Alert.alert('Allocation Error', `Selected app time (${allocated}m) exceeds ${maxTotalMins}m total.`);
                return;
            }
        }

        triggerHaptic('heavy');
        setIsSettingTimers(true);

        // Check Usage Access permission first
        try {
            const hasPermission = await hasUsagePermission();
            if (!hasPermission) {
                Alert.alert(
                    'Permission Required',
                    'App Timer needs Usage Access permission to monitor app usage and enforce time limits.\n\nYou will be taken to Settings. Please find and enable this app.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => setIsSettingTimers(false) },
                        {
                            text: 'Open Settings',
                            onPress: async () => {
                                await openUsageAccessSettings();
                                // Wait for user to come back and re-check
                                const waitAndRetry = () => {
                                    setTimeout(async () => {
                                        const granted = await hasUsagePermission();
                                        if (granted) {
                                            // Permission granted, proceed
                                            await applyTimers(selected);
                                        } else {
                                            setIsSettingTimers(false);
                                            Alert.alert(
                                                'Permission Not Granted',
                                                'Usage Access was not enabled. Timers cannot be set without this permission.'
                                            );
                                        }
                                    }, 3000);
                                };
                                waitAndRetry();
                            },
                        },
                    ]
                );
                return;
            }

            await applyTimers(selected);
        } catch (error) {
            console.error('Permission check failed:', error);
            setIsSettingTimers(false);
            Alert.alert('Error', 'Failed to check permissions. Please try again.');
        }
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
                    {maxTotalMins !== undefined && (
                        <View style={styles.budgetCard}>
                            <Text style={styles.budgetTitle}>TOTAL MOBILE TIME</Text>
                            <Text style={styles.budgetValue}>{selectedTotalMins}/{maxTotalMins}m</Text>
                            <Text style={styles.budgetHint}>Remaining: {remainingMins}m</Text>
                        </View>
                    )}

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchIconBox}>
                            <Text style={styles.searchIcon}>🔍</Text>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="SEARCH APPS"
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
                                const disableNewSelect = maxTotalMins !== undefined && !app.selected && (remainingMins !== null && remainingMins <= 0);
                                return (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[styles.appRow, app.selected && styles.appRowSelected, disableNewSelect && styles.appRowDisabled]}
                                        onPress={() => toggleAppSelection(app.id)}
                                        disabled={disableNewSelect}
                                    >
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
                                            <View style={[styles.tickBox, app.selected && styles.tickBoxActive]}>
                                                {app.selected && <Text style={styles.tickMark}>✓</Text>}
                                            </View>
                                        </View>
                                        <Text style={styles.selectionHint}>Tap card to {app.selected ? 'remove' : 'select'} for focus alignment</Text>

                                        {app.selected && (
                                            <View style={styles.timerContainer}>
                                                <Text style={styles.timerLabel}>Focus timer for this app</Text>
                                                <View style={styles.timerPillsRow}>
                                                    {[15, 20, 30, 40, 60, 120, 240].map((mins) => {
                                                        const active = (app.durationMins || 15) === mins;
                                                        return (
                                                            <TouchableOpacity
                                                                key={`${app.id}-${mins}`}
                                                                activeOpacity={0.85}
                                                                style={[styles.timerPill, active && styles.timerPillActive]}
                                                                disabled={maxTotalMins !== undefined && !active && ((selectedTotalMins - (app.durationMins || 15) + mins) > maxTotalMins)}
                                                                onPress={() => setAppDuration(app.id, mins)}
                                                            >
                                                                <Text style={[styles.timerPillText, active && styles.timerPillTextActive]}>
                                                                    {mins >= 60 ? `${mins / 60}H` : `${mins}M`}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </Animated.View>

                {/* Bottom Controls */}
                {!isLoadingApps && (
                    <>
                        <TouchableOpacity
                            style={styles.floatingPlus}
                            onPress={() => { triggerHaptic('medium'); setShowExpansionModal(true); }}
                        >
                            <Text style={styles.floatingPlusText}>+</Text>
                        </TouchableOpacity>
                        <View style={styles.confirmBar}>
                            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmConfiguration}>
                                {isSyncing ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>CONFIRM CONFIGURATION</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}

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
                                    placeholder="SEARCH APPS"
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
        borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)', backgroundColor: '#151A21'
    },
    backButton: { marginRight: 20 },
    backButtonText: { color: '#94A3B8', fontSize: 13, fontWeight: '800', letterSpacing: 1, fontFamily: FONT_FAMILY_BOLD },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', letterSpacing: 1.5, fontFamily: FONT_FAMILY_BOLD },
    content: { flex: 1, padding: 20 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1B222C', borderRadius: 16,
        paddingHorizontal: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 20, height: 50
    },
    searchIconBox: { marginRight: 12 },
    searchIcon: { fontSize: 16 },
    searchInput: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '600', fontFamily: FONT_FAMILY_MEDIUM },
    budgetCard: { backgroundColor: '#141C26', borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 12, marginBottom: 14 },
    budgetTitle: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    budgetValue: { color: '#22D3EE', fontSize: 18, fontWeight: '900', marginTop: 4 },
    budgetHint: { color: '#CBD5E1', fontSize: 11, marginTop: 2 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { color: '#94A3B8', marginTop: 16, fontWeight: '700', letterSpacing: 1, fontFamily: FONT_FAMILY_MEDIUM },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16, gap: 12 },
    headerLine: { width: 4, height: 18, borderRadius: 2 },
    sectionHeaderText: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5, fontFamily: FONT_FAMILY_BOLD },
    appRow: { backgroundColor: '#171E28', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8 },
    appRowSelected: { borderColor: '#22D3EE', backgroundColor: '#13242B' },
    appRowDisabled: { opacity: 0.45 },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    appInfo: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
    appIconContainer: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#101826', borderWidth: 1.2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    nativeAppIcon: { width: '100%', height: '100%' },
    appName: { fontSize: 15, fontWeight: '800', color: '#F1F5F9', fontFamily: FONT_FAMILY_BOLD },
    appStatus: { fontSize: 11, color: '#64748B', marginTop: 2, fontFamily: FONT_FAMILY_REGULAR },
    tickBox: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.2, borderColor: '#334155', backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
    tickBoxActive: { borderColor: '#22D3EE', backgroundColor: '#16414D' },
    tickMark: { color: '#22D3EE', fontSize: 14, fontWeight: '900', fontFamily: FONT_FAMILY_BOLD },
    selectionHint: { marginTop: 10, color: '#7C8A9D', fontSize: 11, fontFamily: FONT_FAMILY_REGULAR },
    timerContainer: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(148, 163, 184, 0.2)',
        paddingTop: 12,
    },
    timerLabel: {
        color: '#9AA9BE',
        fontSize: 11,
        letterSpacing: 0.4,
        marginBottom: 10,
        fontFamily: FONT_FAMILY_MEDIUM,
    },
    timerPillsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    timerPill: {
        minWidth: 56,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#334155',
        backgroundColor: '#0F172A',
        alignItems: 'center',
    },
    timerPillActive: {
        borderColor: '#22D3EE',
        backgroundColor: '#12303A',
    },
    timerPillText: {
        color: '#A8B5C7',
        fontSize: 11,
        fontFamily: FONT_FAMILY_BOLD,
        letterSpacing: 0.7,
    },
    timerPillTextActive: {
        color: '#D7F7FF',
    },
    floatingPlus: {
        position: 'absolute',
        right: 20,
        bottom: 110,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#1F3B57',
        borderWidth: 1,
        borderColor: '#4A7AA3',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 10,
    },
    floatingPlusText: { color: '#E2F4FF', fontSize: 26, lineHeight: 27, fontFamily: FONT_FAMILY_BOLD },
    confirmBar: {
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 24,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    pickerPanel: { backgroundColor: '#161B22', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 30, borderTopWidth: 1, borderColor: '#334155' },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    pickerTitle: { fontSize: 13, fontWeight: '900', color: '#F8FAFC', letterSpacing: 1.5, fontFamily: FONT_FAMILY_BOLD },
    closeText: { fontSize: 12, color: '#94A3B8', fontWeight: '800', fontFamily: FONT_FAMILY_MEDIUM },
    confirmButton: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: '#3B82F6' },
    confirmButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.4, fontFamily: FONT_FAMILY_BOLD },
    searchAppRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    expansionAddText: { color: '#22D3EE', fontSize: 20, fontFamily: FONT_FAMILY_BOLD },
});
