import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TimetableRow = {
    time_slot: string;
    task_name: string;
    estimated_minutes: number;
};

const FONT_FAMILY_REGULAR = 'sans-serif';
const FONT_FAMILY_MEDIUM = 'sans-serif-medium';
const FONT_FAMILY_BOLD = 'sans-serif-bold';

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const buildRows = (rawTimetable: any): TimetableRow[] => {
    if (!rawTimetable) {
        return [];
    }

    if (Array.isArray(rawTimetable)) {
        return rawTimetable.map((item: any) => {
            return {
                time_slot: item?.time_slot || item?.start_time || item?.time || '-',
                task_name: item?.task_name || item?.subject || item?.description || '-',
                estimated_minutes: item?.estimated_minutes || 0,
            };
        });
    }

    if (typeof rawTimetable === 'object') {
        return Object.entries(rawTimetable).flatMap(([day, entries]) => {
            if (!Array.isArray(entries)) {
                return [];
            }

            return entries.map((item: any) => ({
                time_slot: item?.time_slot || item?.start_time || item?.time || '-',
                task_name: item?.task_name || item?.subject || item?.description || '-',
                estimated_minutes: item?.estimated_minutes || 0,
            }));
        });
    }

    return [];
};

export default function SuggestedTimetableScreen({
    timetableData,
    onBack,
}: {
    timetableData: any;
    onBack: () => void;
}) {
    const rows = buildRows(timetableData);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>← BACK</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>SUGGESTED TIMETABLE</Text>
                <View style={{ width: 62 }} />
            </View>

            {rows.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No timetable suggestion yet</Text>
                    <Text style={styles.emptySubtitle}>Upload a classroom timetable image from landing page.</Text>
                </View>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.table}>
                        <View style={[styles.row, styles.headRow]}>
                            <Text style={[styles.cell, { flex: 0.3 }, styles.headText]}>Time Slot</Text>
                            <Text style={[styles.cell, { flex: 0.5 }, styles.headText]}>Task Name</Text>
                            <Text style={[styles.cell, { flex: 0.2 }, styles.headText, { textAlign: 'center' }]}>Est. Min</Text>
                        </View>

                        {rows.map((item, index) => (
                            <View key={`row-${index}`} style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                                <Text style={[styles.cell, { flex: 0.3 }]} numberOfLines={2}>{item.time_slot || '-'}</Text>
                                <Text style={[styles.cell, { flex: 0.5 }]} numberOfLines={3}>{item.task_name || '-'}</Text>
                                <Text style={[styles.cell, { flex: 0.2 }, { textAlign: 'center' }]} numberOfLines={1}>
                                    {item.estimated_minutes ? `${item.estimated_minutes}m` : '-'}
                                </Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F1115' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    backButton: { paddingVertical: 6, paddingRight: 8 },
    backText: {
        color: '#94A3B8',
        fontSize: 12,
        fontFamily: FONT_FAMILY_BOLD,
        letterSpacing: 0.8,
    },
    headerTitle: {
        color: '#F8FAFC',
        fontSize: 14,
        letterSpacing: 1,
        fontFamily: FONT_FAMILY_BOLD,
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 30 },
    table: {
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#111827',
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    headRow: { backgroundColor: '#1E293B' },
    evenRow: { backgroundColor: '#111827' },
    oddRow: { backgroundColor: '#0F172A' },
    cell: {
        color: '#E2E8F0',
        fontSize: 11,
        fontFamily: FONT_FAMILY_REGULAR,
        paddingHorizontal: 8,
        paddingVertical: 12,
    },
    headText: {
        color: '#93C5FD',
        fontFamily: FONT_FAMILY_BOLD,
        fontSize: 10,
        letterSpacing: 0.5,
    },
    dayCol: { flex: 1.25 },
    timeCol: { flex: 1 },
    subjectCol: { flex: 2 },
    codeCol: { flex: 1.1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyTitle: { color: '#F1F5F9', fontSize: 17, fontFamily: FONT_FAMILY_BOLD, marginBottom: 8 },
    emptySubtitle: { color: '#94A3B8', fontSize: 13, fontFamily: FONT_FAMILY_MEDIUM, textAlign: 'center' },
});
