/**
 * The five lessons a student works through, in the app, on their own case.
 *
 * Each lesson has a task done in the real editor, a check that reads the
 * student's own data (so nothing can be passed by clicking through), and one
 * question that tests whether they understood why the task mattered. The
 * checks live here, away from the UI, so they can be tested.
 */

export type LessonId = 'scope' | 'inventory' | 'energy' | 'impact' | 'compare' | 'handin';

export type LessonFacts = {
  /** Functional unit written and a reference flow greater than zero. */
  functionalUnitSet: boolean;
  /** Layers the case actually contains: 'materials', 'energy', 'emissions', … */
  layers: string[];
  /** A completed assessment run exists. */
  hasRun: boolean;
  /** Another case in this project that has its own run (a what-if to compare). */
  hasComparableCase: boolean;
  /** The author wrote their interpretation. */
  hasWriteUp: boolean;
};

export type Question =
  | {
      kind: 'choice';
      prompt: string;
      options: Array<{ id: string; text: string }>;
      correct: string;
      /** Shown after answering, whichever way it went. */
      because: string;
    }
  | {
      kind: 'number';
      prompt: string;
      /** Accepted within tolerance, because the point is the method, not rounding. */
      answer: number;
      tolerance: number;
      unit: string;
      because: string;
    };

export type Lesson = {
  id: LessonId;
  title: string;
  /** One line: what this phase of an LCA is for. */
  goal: string;
  /** What to do in the app. */
  task: string;
  /** What the check is looking for, said plainly, so it is never a mystery. */
  checkLabel: string;
  done: (f: LessonFacts) => boolean;
  question?: Question;
};

export const LESSONS: Lesson[] = [
  {
    id: 'scope',
    title: 'Goal and scope',
    goal: 'Every result is per something. Decide what, before you measure anything.',
    task: 'Open Goal & scope and write the functional unit, the reference flow and the boundary.',
    checkLabel: 'Functional unit written and reference flow above zero',
    done: (f) => f.functionalUnitSet,
    question: {
      kind: 'choice',
      prompt: 'Which of these is a functional unit?',
      options: [
        { id: 'a', text: '2.2 kg of aluminum tube' },
        { id: 'b', text: 'One touring bicycle, at the factory gate' },
        { id: 'c', text: 'The frame shop in Portland' },
      ],
      correct: 'b',
      because:
        'A functional unit names the service delivered, how much of it, and where the boundary ends. 2.2 kg of tube is a flow inside the model, and a factory is a place, not a unit of service.',
    },
  },
  {
    id: 'inventory',
    title: 'Inventory: materials',
    goal: 'The inventory is what physically goes in and out. It is where the numbers come from.',
    task: 'Add one material input to the step that consumes it, with the amount from your document.',
    checkLabel: 'At least one material flow attached to a step',
    done: (f) => f.layers.includes('materials'),
    question: {
      kind: 'choice',
      prompt:
        'Your bill of materials lists 2.2 kg of aluminum tube. Which step should carry that flow?',
      options: [
        { id: 'a', text: 'The product node, so it covers the whole bike' },
        { id: 'b', text: 'The step that first consumes the tube, the one that cuts it' },
        { id: 'c', text: 'Final assembly, because that is where the bike exists' },
      ],
      correct: 'b',
      because:
        'Flows hang off the step that consumes them. Put it there and the result can tell you which step to change; put it on the product and every step looks equally innocent.',
    },
  },
  {
    id: 'energy',
    title: 'Inventory: energy',
    goal: 'Energy is the input a document almost never states per step. You work it out.',
    task: 'Add an electricity flow to a process step, using the machine calculator if you have rated power and run time.',
    checkLabel: 'At least one energy flow in the case',
    done: (f) => f.layers.includes('energy'),
    question: {
      kind: 'number',
      prompt:
        'A 5.6 kW machine runs for 0.8 hours at 8% average load. How many kWh does that step use?',
      answer: 0.3584,
      tolerance: 0.02,
      unit: 'kWh',
      because:
        'kWh = rated power x hours x load. 5.6 x 0.8 x 0.08 = 0.3584 kWh. Skipping the load factor overstates shop electricity by more than ten times.',
    },
  },
  {
    id: 'impact',
    title: 'Impact assessment',
    goal: 'Characterization turns kilograms into an environmental effect, per category.',
    task: 'Predict which step will carry the most climate impact, then run the assessment and see.',
    checkLabel: 'A completed run exists',
    done: (f) => f.hasRun,
    question: {
      kind: 'choice',
      prompt: 'Two steps emit the same mass. Why can their climate impacts still differ?',
      options: [
        { id: 'a', text: 'The later step in the routing counts for more' },
        { id: 'b', text: 'Each substance has its own characterization factor' },
        { id: 'c', text: 'Because one step costs more to run' },
      ],
      correct: 'b',
      because:
        'A kilogram of methane is not a kilogram of CO2. The method holds a factor per substance per category, and the mass is multiplied by it.',
    },
  },
  {
    id: 'compare',
    title: 'Interpretation by comparison',
    goal: 'One number means little. A number next to a fair alternative means something.',
    task: 'Duplicate this case, change one thing, run it, and open Compare.',
    checkLabel: 'A second case in this project with its own run',
    done: (f) => f.hasComparableCase,
    question: {
      kind: 'choice',
      prompt: 'Why can a run made with CML not be compared with a run made with TRACI?',
      options: [
        { id: 'a', text: 'They characterize the same substance differently, so the scales differ' },
        { id: 'b', text: 'TRACI is newer, so its numbers are always lower' },
        { id: 'c', text: 'They use different units for mass' },
      ],
      correct: 'a',
      because:
        'Each method carries its own characterization factors. Comparing across methods measures the methods, not the two products, which is why the comparison screen refuses to mix them.',
    },
  },
  {
    id: 'handin',
    title: 'Hand-in',
    goal: 'The judgement is the assignment. The engine cannot write it for you.',
    task: 'Write your interpretation and your assumptions on the results page, then export the report.',
    checkLabel: 'Interpretation written on this case',
    done: (f) => f.hasWriteUp,
  },
];

export type LearningState = {
  version: 1;
  /** Per lesson: the answer given, whether it was right, and when it was finished. */
  lessons: Partial<Record<LessonId, { answer?: string; correct?: boolean; doneAt?: string }>>;
  /** The step named before the first run, so the reveal can be honest. */
  prediction?: { step: string; madeAt: string };
};

export const EMPTY_STATE: LearningState = { version: 1, lessons: {} };

export function parseLearningState(raw: unknown): LearningState {
  if (!raw) return EMPTY_STATE;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return EMPTY_STATE;
    const lessons = (obj as any).lessons;
    return {
      version: 1,
      lessons: lessons && typeof lessons === 'object' ? lessons : {},
      prediction: (obj as any).prediction,
    };
  } catch {
    return EMPTY_STATE;
  }
}

/** A lesson counts as complete when the work is done AND the question is right. */
export function lessonComplete(lesson: Lesson, facts: LessonFacts, state: LearningState): boolean {
  if (!lesson.done(facts)) return false;
  if (!lesson.question) return true;
  return state.lessons[lesson.id]?.correct === true;
}

export function progress(facts: LessonFacts, state: LearningState) {
  const done = LESSONS.filter((l) => lessonComplete(l, facts, state));
  const current = LESSONS.find((l) => !lessonComplete(l, facts, state)) ?? null;
  return { doneCount: done.length, total: LESSONS.length, current };
}

/** Numeric answers are judged by relative closeness, not by string equality. */
export function numberIsRight(given: number, q: Extract<Question, { kind: 'number' }>): boolean {
  if (!isFinite(given)) return false;
  if (q.answer === 0) return Math.abs(given) <= q.tolerance;
  return Math.abs(given - q.answer) / Math.abs(q.answer) <= q.tolerance;
}
