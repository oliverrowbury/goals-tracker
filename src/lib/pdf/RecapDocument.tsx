import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// A single flexible recap layout shared by the weekly, monthly, and yearly
// PDF exports (see api/export/recap/*) — one component rather than three
// near-identical ones, since the only real differences between them are
// which sections have data. @react-pdf/renderer ships its own PDF-specific
// Document/Page/Text/View primitives (not real DOM/HTML), so this can't
// reuse WeeklyRecap/MonthlyRecap's own JSX directly.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: "#242b29" },
  appName: { fontSize: 10, color: "#0e7d74", fontWeight: 700, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 12, color: "#5a6764", marginBottom: 20 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 20 },
  stat: { minWidth: 110 },
  statValue: { fontSize: 16, fontWeight: 700 },
  statLabel: { fontSize: 9, color: "#5a6764" },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8, paddingBottom: 4, borderBottom: "1pt solid #dde1da" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottom: "0.5pt solid #ece9e2" },
  rowLabel: { flex: 1 },
  rowValue: { color: "#5a6764" },
  rowValueHit: { color: "#0e7d74", fontWeight: 700 },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  subjectRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottom: "0.5pt solid #ece9e2" },
  empty: { color: "#5a6764", fontSize: 10 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9aa6a3", textAlign: "center" },
});

export type GoalRow = { id: string; title: string; detail: string; hit: boolean };
export type SubjectRow = { subjectId: string; name: string; minutes: number; color: string };

export function RecapDocument({
  title,
  subtitle,
  stats,
  goals,
  goalsEmptyLabel,
  subjects,
  subjectsTotalLabel,
  subjectsEmptyLabel,
  workoutSummaryLabel,
  generatedAtLabel,
}: {
  title: string;
  subtitle: string;
  stats?: { label: string; value: string }[];
  goals?: GoalRow[];
  goalsEmptyLabel?: string;
  subjects: SubjectRow[];
  subjectsTotalLabel: string;
  subjectsEmptyLabel: string;
  workoutSummaryLabel: string;
  generatedAtLabel: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.appName}>PROUDLY</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {stats && stats.length > 0 && (
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {goals !== undefined && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goals</Text>
            {goals.length === 0 ? (
              <Text style={styles.empty}>{goalsEmptyLabel}</Text>
            ) : (
              goals.map((g) => (
                <View key={g.id} style={styles.row}>
                  <Text style={styles.rowLabel}>{g.title}</Text>
                  <Text style={g.hit ? styles.rowValueHit : styles.rowValue}>{g.detail}</Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study time</Text>
          {subjects.length === 0 ? (
            <Text style={styles.empty}>{subjectsEmptyLabel}</Text>
          ) : (
            <>
              {subjects.map((s) => (
                <View key={s.subjectId} style={styles.subjectRow}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text style={styles.rowLabel}>{s.name}</Text>
                  <Text style={styles.rowValue}>{s.minutes >= 60 ? `${Math.round((s.minutes / 60) * 10) / 10}h` : `${s.minutes}m`}</Text>
                </View>
              ))}
              <Text style={[styles.empty, { marginTop: 6 }]}>{subjectsTotalLabel}</Text>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workouts</Text>
          <Text style={styles.rowValue}>{workoutSummaryLabel}</Text>
        </View>

        <Text style={styles.footer}>{generatedAtLabel} · proudlyapp.co.uk · Proudly Premium</Text>
      </Page>
    </Document>
  );
}
