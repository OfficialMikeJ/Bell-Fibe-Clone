// Mock data for StreamVault TV Guide

export const mockChannels = [
  {
    id: '1',
    name: 'Premium Movies 1',
    number: '1303',
    logo: 'https://via.placeholder.com/200x120/0056A8/ffffff?text=Channel+1303',
    description: 'Watch the latest blockbuster movies and exclusive premieres'
  },
  {
    id: '2',
    name: 'Entertainment Plus',
    number: '1304',
    logo: 'https://via.placeholder.com/200x120/8B0000/ffffff?text=Channel+1304',
    description: 'Your destination for premium entertainment and series'
  },
  {
    id: '3',
    name: 'Cinema HD',
    number: '1305',
    logo: 'https://via.placeholder.com/200x120/0056A8/ffffff?text=Channel+1305',
    description: 'High-definition cinema experience at home'
  },
  {
    id: '4',
    name: 'Drama Network',
    number: '1306',
    logo: 'https://via.placeholder.com/200x120/1a1a1a/ffffff?text=Channel+1306',
    description: 'Award-winning dramas and original series'
  },
  {
    id: '5',
    name: 'Action Channel',
    number: '1307',
    logo: 'https://via.placeholder.com/200x120/2a2a2a/ffffff?text=Channel+1307',
    description: 'Non-stop action and adventure programming'
  }
];

export const mockPrograms = {
  '1': [
    { time: '10:30', title: 'Morning Action', duration: 30 },
    { time: '11:00', title: 'Thriller Hour', duration: 60 },
    { time: '12:00', title: 'Afternoon Special', duration: 90 }
  ],
  '2': [
    { time: '10:30', title: 'Comedy Show', duration: 60 },
    { time: '11:30', title: 'Drama Series', duration: 30 },
    { time: '12:00', title: 'Reality TV', duration: 60 }
  ],
  '3': [
    { time: '10:30', title: 'Classic Movie', duration: 30 },
    { time: '11:00', title: 'New Release', duration: 90 },
    { time: '12:30', title: 'Director\'s Cut', duration: 30 }
  ],
  '4': [
    { time: '10:30', title: 'Mystery Drama', duration: 60 },
    { time: '11:30', title: 'Crime Investigation', duration: 30 },
    { time: '12:00', title: 'Legal Drama', duration: 60 }
  ],
  '5': [
    { time: '10:30', title: 'Spy Thriller', duration: 30 },
    { time: '11:00', title: 'Action Movie', duration: 60 },
    { time: '12:00', title: 'Adventure Series', duration: 60 }
  ]
};

// Time slots for the guide (30-minute intervals)
export const timeSlots = [
  '10:00 a.m.',
  '10:30 a.m.',
  '11:00 a.m.',
  '11:30 a.m.',
  '12:00 p.m.',
  '12:30 p.m.',
  '1:00 p.m.'
];
