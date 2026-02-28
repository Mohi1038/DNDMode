import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FinalJsonPreviewScreenProps {
    finalJson: Record<string, any>;
    onBack: () => void;
}

export default function FinalJsonPreviewScreen({ finalJson, onBack }: FinalJsonPreviewScreenProps) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <Text style={styles.title}>Final Payload JSON</Text>
                <TouchableOpacity onPress={onBack} style={styles.closeBtn}>
                    <Text style={styles.closeText}>DONE</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                <View style={styles.codeCard}>
                    <Text style={styles.codeText}>{JSON.stringify(finalJson, null, 2)}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0F1115',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    title: {
        color: '#F1F5F9',
        fontSize: 16,
        fontWeight: '700',
    },
    closeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#334155',
    },
    closeText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    body: {
        flex: 1,
    },
    bodyContent: {
        padding: 20,
    },
    codeCard: {
        backgroundColor: '#0B1220',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 16,
    },
    codeText: {
        color: '#CFE8FF',
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Menlo',
    },
});
