/** Line icons used in the tab bar and top bar (stroke = currentColor). */
const P = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const IconToday = () => <svg {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const IconCircles = () => <svg {...P}><circle cx="12" cy="4" r="2" /><circle cx="18.9" cy="8" r="2" /><circle cx="18.9" cy="16" r="2" /><circle cx="12" cy="20" r="2" /><circle cx="5.1" cy="16" r="2" /><circle cx="5.1" cy="8" r="2" /></svg>;
export const IconFood = () => <svg {...P}><circle cx="13" cy="13" r="7" /><circle cx="13" cy="13" r="3.5" /><path d="M3 3v6a2 2 0 0 0 2 2M5 3v18" /></svg>;
export const IconCommunity = () => <svg {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.8 0 5 2 5 5" /></svg>;
export const IconFaq = () => <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" /><path d="M12 17h.01" /></svg>;
export const IconClients = () => <svg {...P}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
export const IconChat = () => <svg {...P} width={18} height={18}><path d="M4 5h16v11H9l-5 4z" /></svg>;
export const IconCheckin = () => <svg {...P}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 13l2 2 4-4" /></svg>;
export const IconScale = () => <svg {...P} width={18} height={18}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 9a5 5 0 0 1 8 0" /><path d="M12 9l1.5-2" /></svg>;
export const IconPlate = () => <svg {...P} width={18} height={18}><circle cx="13" cy="13" r="7" /><circle cx="13" cy="13" r="3.5" /><path d="M3 3v6a2 2 0 0 0 2 2M5 3v18" /></svg>;
export const IconHabits = () => <svg {...P} width={18} height={18}><path d="M4 6l2 2 3-3M4 13l2 2 3-3M4 20l2 2 3-3" /><path d="M13 7h7M13 14h7M13 21h7" /></svg>;
export const IconLessons = () => <svg {...P}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10.5 9.5v5l4-2.5z" /></svg>;
export const IconCalendar = () => <svg {...P} width={20} height={20}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
export const IconSteps = () => <svg {...P} width={18} height={18}><path d="M7 4c1.7 0 2.5 1.8 2.5 4S8.6 13 7 13s-2.5-2.2-2.5-4.5S5.3 4 7 4zM5 15.5h4M17 9c1.7 0 2.5 1.8 2.5 4s-.9 5-2.5 5-2.5-2.2-2.5-4.5S15.3 9 17 9zM15 20.5h4" /></svg>;

export const IconDumbbell = ({ size = 18 }: { size?: number }) => <svg {...P} width={size} height={size} strokeWidth={size > 18 ? 1.8 : 2}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg>;
export const IconWorkouts = () => <IconDumbbell size={22} />;
