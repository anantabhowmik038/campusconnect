export const modules = [
  { owner: 'Tasnim Binte Rabbani', area: 'Identity & Clubs', features: [
    { id: 'F01', name: 'Authentication & RBAC', implemented: true, description: 'Register, sign in, and access tools based on your role.' },
    { id: 'F02', name: 'Club Directory & Administration', implemented: true, description: 'Browse and filter clubs, and manage club details with the appropriate permissions.' },
    { id: 'F03', name: 'Club Membership Management', implemented: false, description: 'Apply to join clubs, review applications, and manage memberships.' },
  ] },
  { owner: 'Ananta Bhowmik', area: 'Events & Registration', features: [
    { id: 'F04', name: 'Event Proposal & Approval', implemented: true, description: 'Draft and submit event proposals for administrator approval or rejection.' },
    { id: 'F05', name: 'Event Discovery & Filtering', implemented: true, description: 'Search and filter published events, then open their details.' },
    { id: 'F06', name: 'Registration & Waitlist', implemented: false, description: 'Register for events and join waitlists when spaces fill.' },
  ] },
  { owner: 'Rayed Mahmud', area: 'Event Operations', features: [
    { id: 'F07', name: 'QR Attendance', implemented: true, description: 'Generate signed QR tickets for existing registrations, check in attendees, and view rosters.' },
    { id: 'F08', name: 'Venue Booking & Conflict Detection', implemented: true, description: 'View venue schedules, request bookings, and review requests with overlap checks.' },
    { id: 'F09', name: 'Volunteer Recruitment & Shifts', implemented: false, description: 'Recruit event volunteers and coordinate shift assignments.' },
  ] },
  { owner: 'Omar Khaium', area: 'Communication & Analytics', features: [
    { id: 'F10', name: 'Announcements & Notifications', implemented: true, description: 'Read campus announcements and manage your in-app notifications.' },
    { id: 'F11', name: 'Post-Event Feedback & Ratings', implemented: true, description: 'Review completed events you attended and see rating summaries.' },
    { id: 'F12', name: 'Club & Event Analytics', implemented: false, description: 'Track club activity, event participation, and feedback trends.' },
  ] },
];
