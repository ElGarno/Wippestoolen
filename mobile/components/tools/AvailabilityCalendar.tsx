import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useState, useMemo } from "react";
import { colors } from "../../constants/colors";
import { useToolAvailabilityCalendar } from "../../hooks/useBookings";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface AvailabilityCalendarProps {
  toolId: string;
}

function toISODateString(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the 0-based weekday index (0=Monday … 6=Sunday) of the 1st of the month.
 */
function getFirstWeekdayIndex(year: number, month: number): number {
  // getDay() returns 0=Sunday … 6=Saturday; we want 0=Monday
  const jsDay = new Date(year, month, 1).getDay();
  return (jsDay + 6) % 7;
}

export default function AvailabilityCalendar({ toolId }: AvailabilityCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based

  const startDate = toISODateString(year, month, 1);
  const endDate = toISODateString(year, month, getDaysInMonth(year, month));

  const { data, isLoading } = useToolAvailabilityCalendar(toolId, startDate, endDate);

  // Build a lookup map: "YYYY-MM-DD" → available (boolean)
  const availabilityMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    data?.calendar.forEach((entry) => {
      map[entry.date] = entry.available;
    });
    return map;
  }, [data]);

  const todayString = toISODateString(today.getFullYear(), today.getMonth(), today.getDate());

  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekdayIndex(year, month);

  // Total cells = leading empty slots + actual days
  const totalCells = firstWeekday + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <View>
      {/* Month navigation header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton} hitSlop={8}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton} hitSlop={8}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday column headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Loading overlay — same height as calendar grid */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary[600]} />
        </View>
      )}

      {/* Day grid */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View key={rowIdx} style={styles.weekRow}>
          {Array.from({ length: 7 }).map((_, colIdx) => {
            const cellIdx = rowIdx * 7 + colIdx;
            const dayNumber = cellIdx - firstWeekday + 1;

            if (dayNumber < 1 || dayNumber > daysInMonth) {
              // Empty placeholder for days outside this month
              return <View key={colIdx} style={styles.dayCell} />;
            }

            const dateString = toISODateString(year, month, dayNumber);
            const isPast = dateString < todayString;
            const isToday = dateString === todayString;
            // If data not yet loaded, treat as unknown (no color)
            const available = availabilityMap[dateString];
            const isUnavailable = available === false;

            return (
              <View key={colIdx} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    isUnavailable && !isPast && styles.unavailableCircle,
                    isToday && styles.todayCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isPast && styles.pastDayText,
                      isUnavailable && !isPast && styles.unavailableDayText,
                    ]}
                  >
                    {dayNumber}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.unavailableCircle]} />
          <Text style={styles.legendLabel}>Verliehen</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.availableCircle]} />
          <Text style={styles.legendLabel}>Verfügbar</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.todayCircle]} />
          <Text style={styles.legendLabel}>Heute</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navButton: {
    padding: 4,
  },
  navArrow: {
    fontSize: 22,
    color: colors.primary[600],
    fontWeight: "600",
    lineHeight: 26,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.gray[400],
    textTransform: "uppercase",
  },
  loadingOverlay: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  unavailableCircle: {
    backgroundColor: colors.error, // #DC2626
  },
  todayCircle: {
    borderWidth: 2,
    borderColor: colors.primary[600], // #E8470A
  },
  availableCircle: {
    backgroundColor: colors.gray[100],
  },
  dayText: {
    fontSize: 13,
    color: colors.gray[900],
    fontWeight: "500",
  },
  pastDayText: {
    color: colors.gray[300],
    fontWeight: "400",
  },
  unavailableDayText: {
    color: colors.white,
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.gray[100],
  },
  legendLabel: {
    fontSize: 11,
    color: colors.gray[500],
  },
});
