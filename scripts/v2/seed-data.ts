/** Demo businesses for local development and previews (owners use @demo.styra.test addresses). */
export const week = (start: string, end: string, days = [1, 2, 3, 4, 5, 6]) => days.map((weekday) => ({ weekday, start, end }));
export const kes = (shillings: number) => shillings * 100;

export const BUSINESSES = [
  {
    owner: ['Brian Kamau', 'brian@demo.styra.test'],
    business: { name: 'Kinyozi Pro', category: 'BARBER', city: 'Nairobi', address: 'Woodvale Grove, Westlands', phone: '0712345678', description: 'Clean fades, beard sculpting and hot towel shaves. Walk out sharp.', lat: -1.2648, lng: 36.8028 },
    services: [['Classic cut', 30, 600], ['Fade and beard trim', 45, 800], ['Hot towel shave', 30, 700], ['Kids cut (under 12)', 30, 500]],
    hours: week('08:00', '20:00'),
  },
  {
    owner: ['Zawadi Achieng', 'zawadi@demo.styra.test'],
    business: { name: 'Zawadi Braids Studio', category: 'BRAIDS', city: 'Nairobi', address: 'Argwings Kodhek Rd, Kilimani', phone: '0722123456', description: 'Knotless, box braids and cornrows by stylists who take their time.', lat: -1.2921, lng: 36.7836 },
    services: [['Knotless braids, medium', 300, 4500], ['Box braids', 240, 3500], ['Cornrows', 90, 1500]],
    hours: week('09:00', '19:00', [2, 3, 4, 5, 6, 0]),
  },
  {
    owner: ['Kevin Otieno', 'kevin@demo.styra.test'],
    business: { name: 'The Fade Room', category: 'BARBER', city: 'Nairobi', address: 'Ngong Rd, Kilimani', phone: '0733456789', description: 'Precision fades and line-ups. Appointments run on time.', lat: -1.3006, lng: 36.7799 },
    services: [['Skin fade', 40, 700], ['Line-up', 20, 300], ['Cut and wash', 50, 900]],
    hours: week('07:30', '21:00'),
  },
  {
    owner: ['Wanjiku Mwangi', 'wanjiku@demo.styra.test'],
    business: { name: 'Nails by Wanjiku', category: 'NAILS', city: 'Nairobi', address: 'Lavington Mall, Lavington', phone: '0711987654', description: 'Gel, acrylics and natural nail care in a calm studio.', lat: -1.2789, lng: 36.7702 },
    services: [['Gel manicure', 60, 1800], ['Acrylic full set', 90, 3000], ['Pedicure', 60, 1500]],
    hours: week('10:00', '19:00'),
  },
  {
    owner: ['Faith Njeri', 'faith@demo.styra.test'],
    business: { name: 'Serene Spa Kilimani', category: 'SPA', city: 'Nairobi', address: 'Dennis Pritt Rd, Kilimani', phone: '0700112233', description: 'Deep tissue, Swedish and hot stone massage. Quiet rooms, warm towels.', lat: -1.2912, lng: 36.7905 },
    services: [['Swedish massage', 60, 4000], ['Deep tissue massage', 90, 6000], ['Hot stone massage', 75, 5500]],
    hours: week('09:00', '20:00', [0, 1, 2, 3, 4, 5, 6]),
  },
  {
    owner: ['Mercy Wairimu', 'mercy@demo.styra.test'],
    business: { name: 'Zuri Hair Lounge', category: 'HAIR', city: 'Nairobi', address: 'Kimathi St, CBD', phone: '0799887766', description: 'Silk press, wash and set, and treatments for natural hair.', lat: -1.2833, lng: 36.8219 },
    services: [['Silk press', 120, 3000], ['Wash and set', 60, 1500], ['Deep conditioning', 45, 1200]],
    hours: week('08:30', '18:30'),
  },
] as const;
