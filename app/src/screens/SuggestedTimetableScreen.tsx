import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TimetableRow = {
    day: string;
    start_time?: string;
    end_time?: string;
    subject?: string;
    code?: string;
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
        return rawTimetable.map((item: any) => ({
            day: titleCase(item?.day || 'Unknown'),
            start_time: item?.start_time || item?.time || '-',
            end_time: item?.end_time || '-',
            subject: item?.subject || item?.description || '-',
            code: item?.code || '-',
        }));
    }

    if (typeof rawTimetable === 'object') {
        return Object.entries(rawTimetable).flatMap(([day, entries]) => {
            if (!Array.isArray(entries)) {
                return [];
            }

            return entries.map((item: any) => ({
                day: titleCase(day),
                start_time: item?.start_time || item?.time || '-',
                end_time: item?.end_time || '-',
                subject: item?.subject || item?.description || '-',
                code: item?.code || '-',
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
                            <Text style={[styles.cell, styles.dayCol, styles.headText]}>Day</Text>
                            <Text style={[styles.cell, styles.timeCol, styles.headText]}>Start</Text>
                            <Text style={[styles.cell, styles.timeCol, styles.headText]}>End</Text>
                            <Text style={[styles.cell, styles.subjectCol, styles.headText]}>Subject</Text>
                            <Text style={[styles.cell, styles.codeCol, styles.headText]}>Code</Text>
                        </View>

                        {rows.map((item, index) => (
                            <View key={`${item.day}-${item.subject}-${index}`} style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                                <Text style={[styles.cell, styles.dayCol]} numberOfLines={1}>{item.day}</Text>
                                <Text style={[styles.cell, styles.timeCol]} numberOfLines={1}>{item.start_time || '-'}</Text>
                                <Text style={[styles.cell, styles.timeCol]} numberOfLines={1}>{item.end_time || '-'}</Text>
                                <Text style={[styles.cell, styles.subjectCol]} numberOfLines={2}>{item.subject || '-'}</Text>
                                <Text style={[styles.cell, styles.codeCol]} numberOfLines={1}>{item.code || '-'}</Text>
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
