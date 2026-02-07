import { state, days, timeSlots } from './state.js';

/**
 * Checks if a specific slot is free for both the group and the teacher.
 * @param {string} groupId 
 * @param {string} teacherId 
 * @param {string} day 
 * @param {number} startTime 
 * @param {number} duration 
 * @returns {boolean} True if free
 */
export function isSlotFree(groupId, teacherId, day, startTime, duration) {
    const endTime = startTime + duration;

    // 1. Check Group Availability
    const groupBusy = state.schedule.some(c =>
        c.groupId === groupId &&
        c.day === day &&
        c.startTime < endTime && (c.startTime + c.duration) > startTime
    );
    if (groupBusy) return false;

    // 2. Check Teacher Availability (if teacher assigned)
    if (teacherId) {
        const teacherBusy = state.schedule.some(c =>
            c.teacherId === teacherId &&
            c.day === day &&
            c.startTime < endTime && (c.startTime + c.duration) > startTime
        );
        if (teacherBusy) return false;
    }

    return true;
}

/**
 * Attempts to generate a schedule for a specific group.
 * Uses a Greedy algorithm with simple heuristics.
 * @param {string} groupId 
 */
export function generateScheduleForGroup(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return { success: false, message: "Grupo no encontrado" };

    // 1. Identify Needed Subjects
    // Filter subjects for this trimester
    const subjects = state.subjects.filter(s => s.trimester === group.trimester);

    // Calculate remaining hours for each subject
    const needed = subjects.map(s => {
        const target = s.weeklyHours || 4;
        const current = state.schedule
            .filter(c => c.groupId === groupId && c.subjectId === s.id)
            .reduce((acc, c) => acc + c.duration, 0);
        return {
            ...s,
            remaining: Math.max(0, target - current)
        };
    }).filter(s => s.remaining > 0);

    if (needed.length === 0) return { success: true, message: "El grupo ya tiene carga completa.", newClasses: [] };

    // 2. Sorting Heuristic: Hardest First?
    // Sort by: Has Default Teacher (Harder) > Remaining Hours (Larger blocks)
    needed.sort((a, b) => {
        if (a.defaultTeacherId && !b.defaultTeacherId) return -1;
        if (!a.defaultTeacherId && b.defaultTeacherId) return 1;
        return b.remaining - a.remaining;
    });

    const newClasses = [];
    const proposedSchedule = [...state.schedule]; // Local copy to track progressive filling

    // 3. Allocation Loop
    for (const sub of needed) {
        let hoursToAssign = sub.remaining;

        // Try to assign in blocks of 2 hours, then 1 hour
        while (hoursToAssign > 0) {
            const duration = hoursToAssign >= 2 ? 2 : 1;
            let assigned = false;

            // Iterate Days and Times (Randomized or Linear?)
            // Linear optimization: Try to fill Mon-Fri, Morning/Evening based on Shift
            // TODO: Detect Shift preference from Group settings or heuristics

            // 3.1 Shift Logic
            // Determine valid hours based on Group or Global Settings
            // Assumption: Group shift is not explicitly stored, but we can infer or ask. 
            // For now, let's use the global "Shift Cutoff" split.
            const cutoff = state.settings.shiftCutoff || 4; // 1 = 7am. 4 = 10? No, cutoff usually means trim number. 
            // Wait, cutoff in ui.js line 460 is used for Trimester cutoff (Matutino < 4 < Vespertino?? No, usually Trim 1-6 morning, 7-10 evening).
            // Let's assume standard logic: Trimester based shift.

            let validHours = timeSlots;
            if (group.trimester >= cutoff) {
                // Vespertino (High Trimester) -> After 14:00 (which is index 7 in 0-based? No, timeSlots are ints 7..20)
                // Let's assume Evening starts at 14:00.
                validHours = timeSlots.filter(h => h >= 14);
            } else {
                // Matutino (Low Trimester) -> Before 14:00 (or up to 18:00 but preferred morning?)
                // Strict morning: 7 to 14.
                validHours = timeSlots.filter(h => h < 14);
            }

            for (const d of days) {
                if (assigned) break;
                for (const h of validHours) {
                    if (assigned) break;

                    // Check if slot is valid
                    // Note: We use proposedSchedule for tracking internal conflicts in this batch
                    const conflict = proposedSchedule.some(c =>
                        (c.groupId === groupId || (sub.defaultTeacherId && c.teacherId === sub.defaultTeacherId)) &&
                        c.day === d &&
                        c.startTime < (h + duration) && (c.startTime + c.duration) > h
                    );

                    if (!conflict) {
                        // Found a slot!
                        const newClass = {
                            groupId: groupId,
                            subjectId: sub.id,
                            teacherId: sub.defaultTeacherId || null, // Logic for 'No Teacher' later
                            day: d,
                            startTime: h,
                            duration: duration,
                            classroomId: null, // Room logic is harder, leave null
                            type: 'class'
                        };

                        newClasses.push(newClass);
                        proposedSchedule.push(newClass); // Temporarily add to avoid self-overlap
                        hoursToAssign -= duration;
                        assigned = true;
                    }
                }
            }

            if (!assigned) {
                // Could not place this block. Skip to next subject or partial fail.
                console.warn(`Could not place ${duration}h for ${sub.name}`);
                break; // Prevent infinite loop
            }
        }
    }

    return {
        success: newClasses.length > 0,
        message: `Se generaron ${newClasses.length} clases nuevas.`,
        newClasses
    };
}
