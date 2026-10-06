export const DEFAULT_STATE = {
  version: 1,
  activeRole: "athlete",
  profile: {
    firstName: "Eric",
    lastName: "White",
    initials: "EW",
    headline: "Developing Midfielder | Late-Starter Development Journey",
    city: "Grand Rapids",
    region: "Michigan",
    country: "United States",
    ageBand: "18+",
    primaryPosition: "Central Midfielder",
    secondaryPosition: "Right Midfielder",
    dominantFoot: "Right",
    experienceLevel: "Developing / Beginner",
    availability: "Open to adult training, teams, leagues, and development opportunities",
    bio: "I am building my soccer experience later than the traditional youth pathway. My goal is to develop measurable technical, tactical, physical, and game experience while documenting the process honestly. NextStage is designed to make nontraditional player journeys easier to organize, show, and improve.",
    profileCompletion: 82,
    visibility: "Prototype - visible to demo coach/scout view"
  },
  development: {
    totalHours: 42.5,
    trueTouchHours: 19.25,
    weeklyGoal: 8,
    currentWeekHours: 4.5,
    level: "Foundation Builder",
    categories: [
      { name: "Ball Mastery", score: 56 },
      { name: "Passing & Receiving", score: 44 },
      { name: "Finishing", score: 31 },
      { name: "Fitness", score: 48 },
      { name: "Tactical Learning", score: 38 },
      { name: "Game Experience", score: 24 }
    ]
  },
  weeklyHours: [
    { label: "W1", hours: 2.0 },
    { label: "W2", hours: 4.0 },
    { label: "W3", hours: 3.5 },
    { label: "W4", hours: 5.5 },
    { label: "W5", hours: 6.0 },
    { label: "W6", hours: 4.5 }
  ],
  sessions: [
    { id: "s1", date: "2026-10-03", type: "Individual technical", minutes: 75, trueTouchMinutes: 55, focus: "First touch and short passing", notes: "Focused on repeatable receiving angles and cleaner first contact." },
    { id: "s2", date: "2026-09-30", type: "Fitness", minutes: 45, trueTouchMinutes: 0, focus: "Intervals and mobility", notes: "Moderate intensity conditioning." },
    { id: "s3", date: "2026-09-28", type: "Open play", minutes: 90, trueTouchMinutes: 32, focus: "Decision making under pressure", notes: "Tracked game experience and positioning." },
    { id: "s4", date: "2026-09-25", type: "Individual technical", minutes: 60, trueTouchMinutes: 48, focus: "Dribbling and weak-side movement", notes: "Better consistency after first 20 minutes." }
  ],
  goals: [
    { id: "g1", title: "Reach 8 development hours this week", progress: 56, target: "Weekly", detail: "Current: 4.5 of 8 hours" },
    { id: "g2", title: "Complete 25 hours of true-touch work", progress: 77, target: "Short term", detail: "Current: 19.25 of 25 hours" },
    { id: "g3", title: "Join an adult team or structured training group", progress: 30, target: "Winter 2027", detail: "Researching realistic beginner-friendly options" }
  ],
  achievements: [
    { id: "a1", title: "First 40 Development Hours", type: "Milestone", date: "2026-09-29" },
    { id: "a2", title: "10 Technical Sessions Logged", type: "Consistency", date: "2026-09-18" },
    { id: "a3", title: "Player Profile 80% Complete", type: "Profile", date: "2026-09-12" }
  ],
  opportunities: [
    { id: "o1", type: "Adult Team", title: "Grand River Adult FC - Development Squad", organization: "Demo Organization", city: "Grand Rapids, MI", level: "Beginner-Intermediate", schedule: "Tue evenings", cost: "$", description: "Demo adult team opportunity focused on players building organized match experience.", tags: ["18+", "Team", "Tryout"] },
    { id: "o2", type: "Training", title: "Small-Group Technical Development", organization: "West Michigan Soccer Lab - Demo", city: "Kentwood, MI", level: "All levels", schedule: "Sat mornings", cost: "$$", description: "Demo small-group session covering first touch, passing, movement, and finishing.", tags: ["Training", "Small group", "Adult"] },
    { id: "o3", type: "Pickup", title: "Friday Night Adult Open Play", organization: "Community Soccer Network - Demo", city: "Grand Rapids, MI", level: "Recreational", schedule: "Fri 8:00 PM", cost: "$", description: "Demo casual open play for adults seeking game repetitions without a long-term commitment.", tags: ["Pickup", "18+", "Indoor"] },
    { id: "o4", type: "League", title: "Winter Adult Indoor League", organization: "Lakeshore Sports Center - Demo", city: "Wyoming, MI", level: "Recreational", schedule: "Jan-Mar", cost: "$$", description: "Demo indoor league listing with team and individual registration possibilities.", tags: ["League", "Winter", "Indoor"] },
    { id: "o5", type: "Trainer", title: "1-on-1 Technical Trainer", organization: "Alex Morgan Training - Fictional Demo", city: "Grand Rapids, MI", level: "Beginner-Advanced", schedule: "Flexible", cost: "$$$", description: "Fictional demo trainer profile. Personalized sessions and development planning.", tags: ["Private", "Trainer", "Flexible"] },
    { id: "o6", type: "Facility", title: "Community Indoor Field - Open Rental", organization: "Northside Fieldhouse - Demo", city: "Grand Rapids, MI", level: "Any", schedule: "Varies", cost: "$$", description: "Demo facility listing for individual, group, or team field rental.", tags: ["Facility", "Indoor", "Rental"] }
  ],
  savedOpportunityIds: ["o2"],
  notes: {
    coach: "Prototype note: This area would eventually support structured coach/scout observations, athlete-controlled sharing, verified credentials, and recruiting workflows."
  }
};

export const APP_COPY = {
  prototypeDisclaimer: "Prototype V1 uses fictional/demo opportunities and local-only browser data. It does not create a real account or send information to a server.",
  privacyReminder: "Do not enter sensitive personal information into a public prototype. Avoid exact home addresses, financial information, passwords, private school schedules, or private information about minors."
};
