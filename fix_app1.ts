import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add missing imports
content = content.replace(
  "deleteField,",
  "deleteField,\n  serverTimestamp"
);
if (!content.includes('deleteField')) {
  content = content.replace(
    /getDocs\n\} from 'firebase\/firestore';/,
    "getDocs,\n  deleteField,\n  serverTimestamp\n} from 'firebase/firestore';"
  );
}

// 2. Add RealTimeClock before App
if (!content.includes('const RealTimeClock = () => {')) {
  content = content.replace(
    "export default function App() {",
    `const RealTimeClock = () => {
  const [time, setTime] = useState(getNowHHMM());
  useEffect(() => {
    const interval = setInterval(() => setTime(getNowHHMM()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{time}</>;
};

export default function App() {`
  );
}

// Replace currentTime uses related to rendering time
content = content.replace(/\{currentTime\}/g, '{<RealTimeClock />}');
// But remove setCurrentTime from interval
content = content.replace(/setCurrentTime\(now\);/g, '');

// 3. bootstrappedRef
if (!content.includes('const bootstrappedRef = useRef(false);')) {
  content = content.replace(
    'const [user, setUser] = useState<User | null>(null);',
    'const [user, setUser] = useState<User | null>(null);\n  const bootstrappedRef = useRef(false);'
  );
}
content = content.replace(
  /if \(docs\.length === 0\) \{([\s\S]*?)const initial = generateSessions\(\);/,
  `if (docs.length === 0) {
        if (!bootstrappedRef.current) {
          bootstrappedRef.current = true;
          const initial = generateSessions();`
);
content = content.replace(
  /batch\.commit\(\)\.catch\(console\.error\);\n\s*\} else \{/,
  `batch.commit().catch(console.error);
        }
      } else {`
);

// 4. resetDay 500 limit
content = content.replace(
  /const allHistory = await getDocs\(collection\(db, 'history'\)\);\s*allHistory\.docs\.forEach\(docSnap => batch\.delete\(docSnap\.ref\)\);\s*await batch\.commit\(\);/g,
  `const allHistory = await getDocs(collection(db, 'history'));
          
          let opCount = 0;
          let currentBatch = writeBatch(db);
          const commitBatch = async () => {
            if (opCount > 0) {
              await currentBatch.commit();
              currentBatch = writeBatch(db);
              opCount = 0;
            }
          };

          const doOp = async (op: () => void) => {
            op();
            opCount++;
            if (opCount === 490) await commitBatch();
          };

          const initial = generateSessions();
          for (const s of sessions) await doOp(() => currentBatch.delete(doc(db, 'sessions', s.id)));
          for (const s of initial) await doOp(() => currentBatch.set(doc(db, 'sessions', s.id), s));
          for (const g of groups) await doOp(() => currentBatch.delete(doc(db, 'groups', g.id)));
          for (const docSnap of allHistory.docs) await doOp(() => currentBatch.delete(docSnap.ref));
          
          await commitBatch();`
);
// Clean up the old resetDay setup commands
content = content.replace(/const batch = writeBatch\(db\);\s*\/\/ Reset Sessions\s*const initial = generateSessions\(\);\s*sessions\.forEach\(s => batch\.delete\(doc\(db, 'sessions', s\.id\)\)\);\s*initial\.forEach\(s => batch\.set\(doc\(db, 'sessions', s\.id\), s\)\);\s*\/\/ Clear Groups\s*groups\.forEach\(g => batch\.delete\(doc\(db, 'groups', g\.id\)\)\);\s*\/\/ Clear History - Get all to properly clear everything\s*/, '');


// 5. Admin efficiency NaN fix
content = content.replace(
  /const efficiency = Math\.round\(\(stats\.fullSessions \/ sessions\.length\) \* 100\);/g,
  `const efficiency = sessions.length ? Math.round((stats.fullSessions / sessions.length) * 100) : 0;`
);

// 6. Timer interval Firestore logic fix
content = content.replace(
  /useEffect\(\(\) => \{\s*const intervalId = setInterval\(\(\) => \{\s*const now = getNowHHMM\(\);\s*const nowMs = Date\.now\(\);[\s\S]*?\}, 1000\);\s*return \(\) => clearInterval\(intervalId\);\s*\}, \[sessions\]\);/g,
  `useEffect(() => {
    // Timer Effect is now purely for local UI calculation, done natively in computed properties, 
    // but we still need to trigger re-renders to update timestamps correctly.
    // RealTimeClock handles the header time. This interval only exists to push state updates if we used them,
    // actually we can just drop it entirely if we calculate \`isFinished\` dynamically based on \`getNowHHMM()\`.
  }, [sessions]);`
);
// Make sure isFinished check inside app uses dynamic current time or RealTimeClock.
// We will replace s.isFinished checks with dynamic checks where necessary or just rely on minute updates.

// Let's write this script and run it, and see what breaks
fs.writeFileSync('src/App.tsx', content);
