import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc, 
  addDoc 
} from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Load environmental config
import dotenv from 'dotenv';
dotenv.config();

// Firebase Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyDdmqRul8PSduDfjxEOjKyFpIZPSzJzrA0",
  authDomain: "gen-lang-client-0054563256.firebaseapp.com",
  projectId: "gen-lang-client-0054563256",
  storageBucket: "gen-lang-client-0054563256.firebasestorage.app",
  messagingSenderId: "442765701314",
  appId: "1:442765701314:web:19a3a44fbcc5bd5881cb5b"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, "ai-studio-95b3c5ec-de2c-440f-bcf0-c262640ffe8a");

// Security secrets
const HMAC_SECRET = process.env.HMAC_SECRET || 'planzie-hmac-secret-987654321';
const JWT_SECRET = process.env.JWT_SECRET || 'planzie-jwt-secret-555555555';

// Helper: Password hashing
function hashHMAC(text: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(text).digest('hex');
}

// Helper: Signed token generators
function generateToken(username: string): string {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload = `${username}.${expiry}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64');
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return null;
    const [username, expiryStr, signature] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) return null; // expired
    
    const payload = `${username}.${expiry}`;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    if (signature === expectedSignature) {
      return username;
    }
  } catch (err) {
    // ignore decoding errors
  }
  return null;
}

// Gemini Key Fallback Rotation Helper
async function generateWithGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter((key): key is string => !!key && key !== 'MY_GEMINI_API_KEY');

  if (keys.length === 0) {
    throw new Error("No Gemini API Keys configured.");
  }

  let lastError: any = null;

  for (const key of keys) {
    // Up to 2 attempts per key (initial + 1 retry on 503 after 500ms)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
          }
        });
        
        if (response && response.text) {
          return response.text;
        }
        throw new Error("Empty response from Gemini");
      } catch (err: any) {
        lastError = err;
        // Check for 503 or network error
        const is503 = err?.status === 503 || err?.statusCode === 503 || String(err).includes('503');
        if (is503 && attempt === 1) {
          // Wait 500ms and retry
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        // If not 503, or second attempt failed, break to move to next key
        break;
      }
    }
  }

  // If all keys fail
  console.error("Gemini Failure:", lastError);
  throw new Error("Planzie is facing high demand right now — try again in a moment.");
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Track agent metrics for the monospaced bottom status bar
  const agentStatuses = {
    intakeAgent: 'IDLE',
    plannerAgent: 'IDLE',
    recommendationEngine: 'IDLE',
    planZAgent: 'IDLE',
    lastUpdated: new Date().toISOString()
  };

  // Middleware: Auth check
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];
    const username = verifyToken(token);
    if (!username) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    req.username = username;
    next();
  };

  // Auth: Status checks
  app.get('/api/agent-status', (req, res) => {
    res.json({ ...agentStatuses, lastUpdated: new Date().toISOString() });
  });

  // Auth: Register
  app.post('/api/auth/register', async (req, res) => {
    const { username, password, securityQuestion, securityAnswer } = req.body;
    if (!username || !password || !securityQuestion || !securityAnswer) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    try {
      const userRef = doc(db, 'users', cleanUsername);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return res.status(400).json({ error: 'Username is already taken' });
      }

      const passwordHash = hashHMAC(password);
      const securityAnswerHash = hashHMAC(securityAnswer.trim().toLowerCase());

      await setDoc(userRef, {
        username: cleanUsername,
        passwordHash,
        securityQuestion,
        securityAnswerHash,
        createdAt: new Date().toISOString()
      });

      const token = generateToken(cleanUsername);
      res.json({ success: true, token, username: cleanUsername });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal registration error' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    try {
      const userRef = doc(db, 'users', cleanUsername);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      const userData = userSnap.data();
      const passwordHash = hashHMAC(password);
      if (userData.passwordHash !== passwordHash) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      const token = generateToken(cleanUsername);
      res.json({ success: true, token, username: cleanUsername });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal login error' });
    }
  });

  // Auth: Get security question
  app.get('/api/auth/security-question/:username', async (req, res) => {
    const cleanUsername = req.params.username.trim().toLowerCase();
    try {
      const userRef = doc(db, 'users', cleanUsername);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ securityQuestion: userSnap.data().securityQuestion });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal retrieval error' });
    }
  });

  // Auth: Forgot password reset
  app.post('/api/auth/forgot-password', async (req, res) => {
    const { username, securityAnswer, newPassword } = req.body;
    if (!username || !securityAnswer || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    try {
      const userRef = doc(db, 'users', cleanUsername);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(400).json({ error: 'User not found' });
      }

      const userData = userSnap.data();
      const answerHash = hashHMAC(securityAnswer.trim().toLowerCase());
      if (userData.securityAnswerHash !== answerHash) {
        return res.status(400).json({ error: 'Incorrect answer to security question' });
      }

      const newPasswordHash = hashHMAC(newPassword);
      await updateDoc(userRef, { passwordHash: newPasswordHash });

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal reset error' });
    }
  });

  // Tasks: AI Intake Agent Endpoint
  app.post('/api/tasks/ai-intake', authenticate, async (req: any, res) => {
    const { text, clientTime } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Intake text is required' });
    }

    agentStatuses.intakeAgent = 'PROCESSING_INTAKE';

    const timeContext = clientTime || new Date().toISOString();

    const systemInstruction = `You are Planzie's Intake Agent. Extract tasks from informal user language. You MUST reply with structured JSON.`;
    const prompt = `
Extract the task details from the following user query:
"${text}"

Current date/time context: ${timeContext}

You MUST return a JSON object with exactly these keys:
{
  "title": string (clean and concise title),
  "deadline": string (ISO-8601 string representation of the deadline. If date or relative time is tomorrow or next week, compute the exact date. If no deadline specified, default to exactly 7 days from now),
  "effort": number (hours of effort, if not specified default to 1),
  "priority": "High" | "Medium" | "Low" (default to "Medium"),
  "category": string (e.g. Work, Personal, Health, Finance, default to "General")
}
`;

    try {
      const aiResponseText = await generateWithGemini(prompt, systemInstruction);
      let extractedData;
      try {
        extractedData = JSON.parse(aiResponseText.trim());
      } catch (parseErr) {
        // Fallback parsing
        const match = aiResponseText.match(/\{[\s\S]*\}/);
        if (match) {
          extractedData = JSON.parse(match[0]);
        } else {
          throw new Error("Failed to parse Gemini JSON output");
        }
      }

      agentStatuses.intakeAgent = 'SUCCESS';
      res.json(extractedData);
    } catch (err: any) {
      agentStatuses.intakeAgent = 'ERROR';
      const userFriendlyMsg = err.message.includes('Planzie is facing high demand') 
        ? "Planzie is facing high demand right now — try again in a moment."
        : "Planzie is facing high demand right now — try again in a moment.";
      res.status(500).json({ error: userFriendlyMsg });
    }
  });

  // Helper function to evaluate and update escalation state (Plan Z Agent)
  const evaluatePlanZEscalation = async (task: any): Promise<any> => {
    const now = Date.now();
    const deadlineTime = new Date(task.deadline).getTime();
    const createdTime = new Date(task.createdAt || now).getTime();
    
    let level: 'on_track' | 'gentle_reminder' | 'urgent_push' | 'autonomous_action' = 'on_track';
    
    if (task.percentComplete === 100) {
      level = 'on_track'; // fully done
    } else if (deadlineTime <= now) {
      level = 'autonomous_action'; // Overdue and incomplete
    } else {
      const totalTime = deadlineTime - createdTime;
      const elapsedTime = now - createdTime;
      const percentTimeElapsed = totalTime > 0 ? (elapsedTime / totalTime) * 100 : 100;
      const hoursRemaining = (deadlineTime - now) / (1000 * 60 * 60);

      if (task.percentComplete < percentTimeElapsed) {
        if (percentTimeElapsed > 85 || hoursRemaining < 12) {
          level = 'autonomous_action';
        } else if (percentTimeElapsed > 50 || hoursRemaining < 36) {
          level = 'urgent_push';
        } else if (percentTimeElapsed > 20) {
          level = 'gentle_reminder';
        }
      }
    }

    // Helper to determine if drafts are missing or contain previous generation errors
    const isDraftError = (d?: string) => {
      if (!d) return true;
      const lower = d.toLowerCase();
      return lower.includes('facing high demand') || lower.includes('could not be generated') || lower.trim() === '';
    };

    const needsDraft = level === 'autonomous_action' && (
      isDraftError(task.draftRequestingMoreTime) || 
      isDraftError(task.draftMinimumViablePlan) || 
      task.forceRegeneratePlanZ === true
    );

    if (needsDraft) {
      // Clear forceRegeneratePlanZ so it's not persisted to db
      delete task.forceRegeneratePlanZ;
      agentStatuses.planZAgent = `DRAFTING_PLAN_Z_FOR_${task.id}`;
      
      const systemInstruction = `You are Planzie's senior Plan Z productivity strategist and expert workload controller. Your task is to produce exceptionally high-quality, practical, structured, and actionable plan mitigations when a user's task is in danger of failing its deadline.`;
      const prompt = `
The user's task is severely delayed and has escalated to Plan Z status.
Task details:
- Title: ${task.title}
- Category: ${task.category}
- Original Estimated Effort: ${task.effort} hours
- Current Progress: ${task.percentComplete}%
- Final Deadline: ${task.deadline}

Generate two highly-detailed mitigation assets in a single JSON object with exactly these keys:
{
  "requestingMoreTime": string,
  "minimumViablePlan": string
}

Requirements for each key:

1. "requestingMoreTime":
   - Write a polite, highly professional, realistic, and human-sounding draft message requesting a deadline extension.
   - It should be suitable to send to a collaborator, supervisor, client, or team leader.
   - It must acknowledge the current progress, state the exact reason for the requested extension (based on category and title context), propose a realistic new timeline, and detail a clear plan to deliver the work.

2. "minimumViablePlan":
   - Write an incredibly structured, highly actionable, and extremely practical backup plan.
   - It must focus on delivering the absolute minimum viable version of this task immediately to prevent complete failure.
   - You MUST structure this text using clean Markdown.
   - It MUST include:
     - "### 📋 ACTION STEPS" (a numbered list of clear, ordered steps to get this done fast. Every single step must have a strict time estimate [e.g. "Time: 45m" or "Time: 1.5h"] and an individual priority level [e.g. "Priority: CRITICAL" or "Priority: HIGH"]).
     - "### 🏁 MILESTONES & CHECKPOINTS" (clear progress indicators or checkpoint targets to verify velocity and completion).
     - "### 💡 RECOMMENDATIONS" (highly specific, practical productivity hacks and actionable advice tailored directly to the task category and title context to help the user execute with maximum efficiency).
   - Ensure the response is detailed, professional, and useful, avoiding any generic or simple one-line statements.
`;
      try {
        const draftResponseText = await generateWithGemini(prompt, systemInstruction);
        let draftJSON;
        try {
          draftJSON = JSON.parse(draftResponseText.trim());
        } catch (parseErr) {
          const match = draftResponseText.match(/\{[\s\S]*\}/);
          if (match) {
            draftJSON = JSON.parse(match[0]);
          } else {
            throw new Error("Failed to parse Gemini drafts JSON");
          }
        }

        task.draftRequestingMoreTime = draftJSON.requestingMoreTime || 'Draft request for more time could not be generated.';
        task.draftMinimumViablePlan = draftJSON.minimumViablePlan || 'Draft minimum viable plan could not be generated.';
        agentStatuses.planZAgent = 'SUCCESS';
      } catch (err) {
        console.error("Plan Z agent failed to draft:", err);
        task.draftRequestingMoreTime = 'Planzie is facing high demand right now — try again in a moment.';
        task.draftMinimumViablePlan = 'Planzie is facing high demand right now — try again in a moment.';
        agentStatuses.planZAgent = 'ERROR';
      }
    }

    task.escalationLevel = level;
    return task;
  };

  // Tasks: List
  app.get('/api/tasks', authenticate, async (req: any, res) => {
    try {
      agentStatuses.plannerAgent = 'RECONCILING';
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('username', '==', req.username));
      const querySnapshot = await getDocs(q);
      
      let tasks: any[] = [];
      querySnapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() });
      });

      // Run Plan Z agent evaluations on each active task
      let evaluatedTasks: any[] = [];
      let updatedCount = 0;

      for (let task of tasks) {
        const originalLevel = task.escalationLevel;
        const originalDraftTime = task.draftRequestingMoreTime;
        
        const evaluated = await evaluatePlanZEscalation(task);
        evaluatedTasks.push(evaluated);

        // If something changed (escalationLevel or newly generated drafts), update Firestore
        if (evaluated.escalationLevel !== originalLevel || evaluated.draftRequestingMoreTime !== originalDraftTime) {
          const docRef = doc(db, 'tasks', task.id);
          await updateDoc(docRef, {
            escalationLevel: evaluated.escalationLevel,
            draftRequestingMoreTime: evaluated.draftRequestingMoreTime || null,
            draftMinimumViablePlan: evaluated.draftMinimumViablePlan || null
          });
          updatedCount++;
        }
      }

      agentStatuses.plannerAgent = 'SUCCESS';
      res.json(evaluatedTasks);
    } catch (err: any) {
      agentStatuses.plannerAgent = 'ERROR';
      res.status(500).json({ error: err.message || 'Error fetching tasks' });
    }
  });

  // Tasks: Add (Triggers Planner Agent & Recommendation Engine automatically)
  app.post('/api/tasks', authenticate, async (req: any, res) => {
    const { title, deadline, effort, priority, category } = req.body;
    if (!title || !deadline || !effort || !priority || !category) {
      return res.status(400).json({ error: 'All task fields are required' });
    }

    try {
      agentStatuses.plannerAgent = 'ADDING_TASK';
      const newTask = {
        username: req.username,
        title,
        deadline,
        effort: Number(effort),
        priority,
        category,
        percentComplete: 0,
        createdAt: new Date().toISOString(),
        escalationLevel: 'on_track'
      };

      const tasksRef = collection(db, 'tasks');
      const docRef = await addDoc(tasksRef, newTask);
      
      // Auto-trigger the Planner Agent and Recommendation Engine
      agentStatuses.recommendationEngine = 'RECALCULATING';
      
      const fullTask = { id: docRef.id, ...newTask };
      const finalTask = await evaluatePlanZEscalation(fullTask);
      
      // Update with final evaluated escalation levels
      await updateDoc(doc(db, 'tasks', docRef.id), {
        escalationLevel: finalTask.escalationLevel,
        draftRequestingMoreTime: finalTask.draftRequestingMoreTime || null,
        draftMinimumViablePlan: finalTask.draftMinimumViablePlan || null
      });

      agentStatuses.plannerAgent = 'SUCCESS';
      agentStatuses.recommendationEngine = 'SUCCESS';
      
      res.json(finalTask);
    } catch (err: any) {
      agentStatuses.plannerAgent = 'ERROR';
      res.status(500).json({ error: err.message || 'Error saving task' });
    }
  });

  // Tasks: Update (e.g., updating progress or drafts approval)
  app.put('/api/tasks/:id', authenticate, async (req: any, res) => {
    const taskId = req.params.id;
    const updates = req.body;

    try {
      agentStatuses.plannerAgent = 'UPDATING_TASK';
      const docRef = doc(db, 'tasks', taskId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().username !== req.username) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Merge and evaluate escalation
      const mergedTask = { id: taskId, ...docSnap.data(), ...updates };
      const evaluated = await evaluatePlanZEscalation(mergedTask);

      await updateDoc(docRef, {
        ...updates,
        escalationLevel: evaluated.escalationLevel,
        draftRequestingMoreTime: evaluated.draftRequestingMoreTime || null,
        draftMinimumViablePlan: evaluated.draftMinimumViablePlan || null
      });

      agentStatuses.plannerAgent = 'SUCCESS';
      res.json(evaluated);
    } catch (err: any) {
      agentStatuses.plannerAgent = 'ERROR';
      res.status(500).json({ error: err.message || 'Error updating task' });
    }
  });

  // Tasks: Delete
  app.delete('/api/tasks/:id', authenticate, async (req: any, res) => {
    const taskId = req.params.id;
    try {
      const docRef = doc(db, 'tasks', taskId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().username !== req.username) {
        return res.status(404).json({ error: 'Task not found' });
      }
      await deleteDoc(docRef);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting task' });
    }
  });

  // Habits: List
  app.get('/api/habits', authenticate, async (req: any, res) => {
    try {
      const habitsRef = collection(db, 'habits');
      const q = query(habitsRef, where('username', '==', req.username));
      const querySnapshot = await getDocs(q);
      
      let habits: any[] = [];
      querySnapshot.forEach((doc) => {
        habits.push({ id: doc.id, ...doc.data() });
      });
      res.json(habits);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching habits' });
    }
  });

  // Habits: Add
  app.post('/api/habits', authenticate, async (req: any, res) => {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Habit title is required' });
    }

    try {
      const newHabit = {
        username: req.username,
        title: title.trim(),
        streak: 0,
        lastCompletedDate: '', // YYYY-MM-DD
        createdAt: new Date().toISOString()
      };

      const habitsRef = collection(db, 'habits');
      const docRef = await addDoc(habitsRef, newHabit);
      res.json({ id: docRef.id, ...newHabit });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error adding habit' });
    }
  });

  // Habits: Complete
  app.post('/api/habits/:id/complete', authenticate, async (req: any, res) => {
    const habitId = req.params.id;
    const { localToday, localYesterday } = req.body; // e.g., '2026-06-26' and '2026-06-25'

    if (!localToday || !localYesterday) {
      return res.status(400).json({ error: 'Local today and yesterday dates are required' });
    }

    try {
      const docRef = doc(db, 'habits', habitId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().username !== req.username) {
        return res.status(404).json({ error: 'Habit not found' });
      }

      const habit = docSnap.data();
      if (habit.lastCompletedDate === localToday) {
        return res.status(400).json({ error: 'Already completed today.' });
      }

      let newStreak = 1;
      if (habit.lastCompletedDate === localYesterday) {
        newStreak = habit.streak + 1;
      } else {
        newStreak = 1; // missed day(s), reset to 1
      }

      await updateDoc(docRef, {
        streak: newStreak,
        lastCompletedDate: localToday
      });

      res.json({ id: habitId, ...habit, streak: newStreak, lastCompletedDate: localToday });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error completing habit' });
    }
  });

  // Habits: Reset / Delete
  app.delete('/api/habits/:id', authenticate, async (req: any, res) => {
    const habitId = req.params.id;
    try {
      const docRef = doc(db, 'habits', habitId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().username !== req.username) {
        return res.status(404).json({ error: 'Habit not found' });
      }
      await deleteDoc(docRef);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting habit' });
    }
  });

  // Feedback: Submit
  app.post('/api/feedback', authenticate, async (req: any, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Feedback text is required' });
    }

    try {
      const feedbackData = {
        username: req.username,
        text: text.trim(),
        createdAt: new Date().toISOString()
      };

      const feedbackRef = collection(db, 'feedback');
      await addDoc(feedbackRef, feedbackData);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error saving feedback' });
    }
  });

  // Vite Integration & SPA router
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Planzie fullstack server running on http://localhost:${PORT}`);
  });
}

startServer();
