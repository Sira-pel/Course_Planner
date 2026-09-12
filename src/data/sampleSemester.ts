import { SchedulePlan, Course, COURSE_COLORS } from '../types/schedule';

export const SAMPLE_PLANS: SchedulePlan[] = [
  {
    id: 'plan_a',
    name: 'Plan A (Ideal Schedule)',
    courses: [
      {
        id: 'cs101_01',
        code: 'CS 101',
        name: 'Intro to Computer Science',
        section: '01',
        instructor: 'Prof. Alan Turing',
        credits: 4,
        color: COURSE_COLORS[0], // Blue
        sessions: [
          { id: 's_cs1_1', day: 'monday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
          { id: 's_cs1_2', day: 'wednesday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
          { id: 's_cs1_3', day: 'friday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
        ],
      },
      {
        id: 'math201_01',
        code: 'MATH 201',
        name: 'Calculus II',
        section: '01',
        instructor: 'Dr. Leonhard Euler',
        credits: 4,
        color: COURSE_COLORS[1], // Emerald
        sessions: [
          { id: 's_m2_1', day: 'tuesday', startTime: '10:30', endTime: '12:00', room: 'Newton Bldg 204' },
          { id: 's_m2_2', day: 'thursday', startTime: '10:30', endTime: '12:00', room: 'Newton Bldg 204' },
        ],
      },
      {
        id: 'phys105_01',
        code: 'PHYS 105',
        name: 'General Physics & Lab',
        section: '02',
        instructor: 'Dr. Marie Curie',
        credits: 4,
        color: COURSE_COLORS[2], // Amber
        sessions: [
          { id: 's_p1_1', day: 'monday', startTime: '13:30', endTime: '15:00', room: 'Science Ctr 310' },
          { id: 's_p1_2', day: 'wednesday', startTime: '13:30', endTime: '15:00', room: 'Science Ctr 310' },
        ],
      },
      {
        id: 'eng102_01',
        code: 'ENG 102',
        name: 'Academic Writing & Rhetoric',
        section: '04',
        instructor: 'Prof. Virginia Woolf',
        credits: 3,
        color: COURSE_COLORS[4], // Violet
        sessions: [
          { id: 's_e1_1', day: 'tuesday', startTime: '14:00', endTime: '15:15', room: 'Humanities 108' },
          { id: 's_e1_2', day: 'thursday', startTime: '14:00', endTime: '15:15', room: 'Humanities 108' },
        ],
      },
    ],
  },
  {
    id: 'plan_b',
    name: 'Plan B (Afternoon / No Mornings)',
    courses: [
      {
        id: 'cs101_02',
        code: 'CS 101',
        name: 'Intro to Computer Science',
        section: '02',
        instructor: 'Prof. Ada Lovelace',
        credits: 4,
        color: COURSE_COLORS[0],
        sessions: [
          { id: 's_cs2_1', day: 'monday', startTime: '11:30', endTime: '12:45', room: 'Turing Hall 102' },
          { id: 's_cs2_2', day: 'wednesday', startTime: '11:30', endTime: '12:45', room: 'Turing Hall 102' },
          { id: 's_cs2_3', day: 'friday', startTime: '11:30', endTime: '12:45', room: 'Turing Hall 102' },
        ],
      },
      {
        id: 'math201_02',
        code: 'MATH 201',
        name: 'Calculus II',
        section: '02',
        instructor: 'Dr. Gauss',
        credits: 4,
        color: COURSE_COLORS[1],
        sessions: [
          { id: 's_m2b_1', day: 'tuesday', startTime: '13:00', endTime: '14:30', room: 'Newton Bldg 206' },
          { id: 's_m2b_2', day: 'thursday', startTime: '13:00', endTime: '14:30', room: 'Newton Bldg 206' },
        ],
      },
      {
        id: 'psyc101_01',
        code: 'PSYC 101',
        name: 'General Psychology',
        section: '01',
        instructor: 'Dr. Carl Jung',
        credits: 3,
        color: COURSE_COLORS[6], // Cyan
        sessions: [
          { id: 's_psy_1', day: 'tuesday', startTime: '15:30', endTime: '17:00', room: 'Social Sci 12' },
          { id: 's_psy_2', day: 'thursday', startTime: '15:30', endTime: '17:00', room: 'Social Sci 12' },
        ],
      },
      {
        id: 'phys105_02',
        code: 'PHYS 105',
        name: 'General Physics & Lab',
        section: '03',
        instructor: 'Dr. Richard Feynman',
        credits: 4,
        color: COURSE_COLORS[2],
        sessions: [
          { id: 's_p2_1', day: 'monday', startTime: '15:30', endTime: '17:00', room: 'Science Ctr 310' },
          { id: 's_p2_2', day: 'wednesday', startTime: '15:30', endTime: '17:00', room: 'Science Ctr 310' },
        ],
      },
    ],
  },
  {
    id: 'plan_c',
    name: 'Plan C (Fast 3-Day Track)',
    courses: [
      {
        id: 'cs101_03',
        code: 'CS 101',
        name: 'Intro to Computer Science',
        section: '03',
        instructor: 'Prof. Alan Turing',
        credits: 4,
        color: COURSE_COLORS[0],
        sessions: [
          { id: 's_cs3_1', day: 'monday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
          { id: 's_cs3_2', day: 'wednesday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
          { id: 's_cs3_3', day: 'friday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
        ],
      },
      {
        id: 'data220_01',
        code: 'DATA 220',
        name: 'Introduction to Data Science',
        section: '01',
        instructor: 'Dr. Shannon',
        credits: 3,
        color: COURSE_COLORS[7], // Orange
        sessions: [
          { id: 's_dat_1', day: 'monday', startTime: '10:00', endTime: '11:30', room: 'Tech Lab 4B' },
          { id: 's_dat_2', day: 'wednesday', startTime: '10:00', endTime: '11:30', room: 'Tech Lab 4B' },
        ],
      },
      {
        id: 'econ101_01',
        code: 'ECON 101',
        name: 'Principles of Microeconomics',
        section: '02',
        instructor: 'Prof. Adam Smith',
        credits: 3,
        color: COURSE_COLORS[5], // Pink
        sessions: [
          { id: 's_ec_1', day: 'monday', startTime: '13:00', endTime: '14:30', room: 'Business Hall 105' },
          { id: 's_ec_2', day: 'wednesday', startTime: '13:00', endTime: '14:30', room: 'Business Hall 105' },
        ],
      },
    ],
  },
];

export const SAMPLE_CATALOG: Course[] = [
  {
    id: 'cat_cs101_01',
    code: 'CS 101',
    name: 'Intro to Computer Science',
    section: '01',
    instructor: 'Prof. Alan Turing',
    credits: 4,
    color: COURSE_COLORS[0],
    sessions: [
      { id: 's_cat_cs1_1', day: 'monday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
      { id: 's_cat_cs1_2', day: 'wednesday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
      { id: 's_cat_cs1_3', day: 'friday', startTime: '09:00', endTime: '10:15', room: 'Turing Hall 101' },
    ],
  },
  {
    id: 'cat_cs101_02',
    code: 'CS 101',
    name: 'Intro to Computer Science',
    section: '02',
    instructor: 'Prof. Ada Lovelace',
    credits: 4,
    color: COURSE_COLORS[0],
    sessions: [
      { id: 's_cat_cs2_1', day: 'tuesday', startTime: '13:30', endTime: '15:00', room: 'Lovelace Lab 202' },
      { id: 's_cat_cs2_2', day: 'thursday', startTime: '13:30', endTime: '15:00', room: 'Lovelace Lab 202' },
    ],
  },
  {
    id: 'cat_math201_01',
    code: 'MATH 201',
    name: 'Calculus II',
    section: '01',
    instructor: 'Dr. Katherine Johnson',
    credits: 4,
    color: COURSE_COLORS[1],
    sessions: [
      { id: 's_cat_m1_1', day: 'tuesday', startTime: '10:30', endTime: '12:00', room: 'Euler Hall 304' },
      { id: 's_cat_m1_2', day: 'thursday', startTime: '10:30', endTime: '12:00', room: 'Euler Hall 304' },
    ],
  },
  {
    id: 'cat_math201_02',
    code: 'MATH 201',
    name: 'Calculus II',
    section: '02',
    instructor: 'Dr. Carl Gauss',
    credits: 4,
    color: COURSE_COLORS[1],
    sessions: [
      { id: 's_cat_m2_1', day: 'tuesday', startTime: '13:00', endTime: '14:30', room: 'Newton Bldg 206' },
      { id: 's_cat_m2_2', day: 'thursday', startTime: '13:00', endTime: '14:30', room: 'Newton Bldg 206' },
    ],
  },
  {
    id: 'cat_phys105_01',
    code: 'PHYS 105',
    name: 'General Physics & Lab',
    section: '01',
    instructor: 'Dr. Richard Feynman',
    credits: 4,
    color: COURSE_COLORS[2],
    sessions: [
      { id: 's_cat_p1_1', day: 'monday', startTime: '13:30', endTime: '15:00', room: 'Science Ctr 310' },
      { id: 's_cat_p1_2', day: 'wednesday', startTime: '13:30', endTime: '15:00', room: 'Science Ctr 310' },
    ],
  },
  {
    id: 'cat_phys105_03',
    code: 'PHYS 105',
    name: 'General Physics & Lab',
    section: '03',
    instructor: 'Dr. Marie Curie',
    credits: 4,
    color: COURSE_COLORS[2],
    sessions: [
      { id: 's_cat_p3_1', day: 'monday', startTime: '15:30', endTime: '17:00', room: 'Science Ctr 310' },
      { id: 's_cat_p3_2', day: 'wednesday', startTime: '15:30', endTime: '17:00', room: 'Science Ctr 310' },
    ],
  },
  {
    id: 'cat_bio110',
    code: 'BIO 110',
    name: 'General Biology & Ecology',
    section: '01',
    instructor: 'Dr. Charles Darwin',
    credits: 4,
    color: COURSE_COLORS[8],
    sessions: [
      { id: 's_bio_1', day: 'tuesday', startTime: '09:00', endTime: '10:15', room: 'Bio Wing 201' },
      { id: 's_bio_2', day: 'thursday', startTime: '09:00', endTime: '10:15', room: 'Bio Wing 201' },
    ],
  },
  {
    id: 'cat_art105',
    code: 'ART 105',
    name: 'History of Modern Art',
    section: '01',
    instructor: 'Prof. Frida Kahlo',
    credits: 3,
    color: COURSE_COLORS[11],
    sessions: [
      { id: 's_art_1', day: 'friday', startTime: '13:00', endTime: '16:00', room: 'Art Studio 3' },
    ],
  },
  {
    id: 'cat_chem101',
    code: 'CHEM 101',
    name: 'General Chemistry I',
    section: '02',
    instructor: 'Dr. Dmitri Mendeleev',
    credits: 4,
    color: COURSE_COLORS[9],
    sessions: [
      { id: 's_chem_1', day: 'monday', startTime: '11:00', endTime: '12:15', room: 'Chem Lab 102' },
      { id: 's_chem_2', day: 'wednesday', startTime: '11:00', endTime: '12:15', room: 'Chem Lab 102' },
    ],
  },
  {
    id: 'cat_psyc101',
    code: 'PSYC 101',
    name: 'General Psychology',
    section: '01',
    instructor: 'Dr. Carl Jung',
    credits: 3,
    color: COURSE_COLORS[6],
    sessions: [
      { id: 's_psy_1', day: 'tuesday', startTime: '15:30', endTime: '17:00', room: 'Social Sci 12' },
      { id: 's_psy_2', day: 'thursday', startTime: '15:30', endTime: '17:00', room: 'Social Sci 12' },
    ],
  },
];
