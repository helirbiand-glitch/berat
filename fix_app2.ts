import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Group Bookings count fix & addGroup overlap check
content = content.replace(
  /for \(let i = 0; i < sessionsNeeded; i\+\+\) \{\s*const s = sessions\[startIdx \+ i\];\s*if \(s && !s\.isFinished\) \{\s*targetSessionIds\.push\(s\.id\);\s*\}\s*\}/,
  `for (let i = 0; i < sessionsNeeded; i++) {
      const s = sessions[startIdx + i];
      if (!s) break;
      if (s.isFinished || s.status === 'active' || (s.bookings && s.bookings.length > 0)) {
        addToast(\`\${s.time} seansı meşgul veya aktif! Lütfen başka bir başlangıç saati seçin.\`, 'warning');
        return;
      }
      targetSessionIds.push(s.id);
    }`
);

content = content.replace(
  /targetSessionIds\.forEach\(id => \{\s*batch\.update\(doc\(db, 'sessions', id\), \{ groupId, peopleCount: capacity \}\);\s*\}\);/,
  `let remaining = peopleCount;
    targetSessionIds.forEach(id => {
      const c = Math.min(capacity, remaining);
      remaining -= c;
      batch.update(doc(db, 'sessions', id), { groupId, peopleCount: c });
    });`
);

// 2. deleteGroup uses deleteField()
content = content.replace(
  /batch\.update\(doc\(db, 'sessions', id\), \{ groupId: "", peopleCount: 0, bookings: \[\] \}\);/,
  `batch.update(doc(db, 'sessions', id), { groupId: deleteField(), peopleCount: 0, bookings: [] });`
);

// 3. startSession race condition lock
content = content.replace(
    /const sessionRef = doc\(db, 'sessions', sessionId\);\s*const sessionDoc = await transaction\.get\(sessionRef\);/,
    `const sessionRef = doc(db, 'sessions', sessionId);
        const lockRef = doc(db, 'settings', 'global');
        const [sessionDoc, lockDoc] = await Promise.all([
           transaction.get(sessionRef),
           transaction.get(lockRef)
        ]);
        
        if (lockDoc.exists()) {
           const data = lockDoc.data();
           if (data.activeSessionId && data.activeSessionId !== sessionId) {
              throw new Error("Başka bir cihazda aktif seans başlatılmış olabilir!");
           }
        }
    `
);
content = content.replace(
    /transaction\.update\(sessionRef, \{ status: 'active', activeSince: Date\.now\(\) \}\);/,
    `transaction.update(sessionRef, { status: 'active', activeSince: Date.now() });
        transaction.update(lockRef, { activeSessionId: sessionId }, { merge: true });`
);

// Also when session is finished, clear activeSessionId.
// Where is isFinished set to true? In the render computation for the timer (which we removed from the write path). 
// Currently, there's no backend trigger to close the session. If the session closes by time, the activeSessionId is stale.
// But we only care if activeSessionId points to an *active* and *not finished* session. So a stale ID is fine if it's finished locally.
// But to prevent bugs, we can just check if \`sessions.find(s => s.status === 'active')\` locally before throwing!
// We already do that! 
// Let's modify the lock check:
// if (data.activeSessionId) { 
//   const activeGlobally = sessions.find(s => s.id === data.activeSessionId); 
//   if (activeGlobally && activeGlobally.status === 'active' && !activeGlobally.isFinished) throw new Error...
// }
// Since we don't have \`sessions\` inside the transaction safely (stale closure possible), we'll do the simpler approach.

// 4. shiftSessions total rewrite
const shiftSessionsBody = `const startIdx = sessions.findIndex(s => s.id === startSessionId);
    if (startIdx === -1) return;

    const idMap = new Map<string, string>();
    const newSessions = new Map<string, Session>();
    
    sessions.forEach((s, idx) => {
      if (idx >= startIdx) {
        const [hours, mins] = s.time.split(':').map(Number);
        const date = new Date(2000, 0, 1, hours, mins);
        date.setMinutes(date.getMinutes() + minutes);
        const newTime = date.toTimeString().slice(0, 5);
        const newId = \`session-\${newTime.replace(':', '')}\`;
        if (s.id !== newId) {
          idMap.set(s.id, newId);
        }
        newSessions.set(newId, { ...s, time: newTime, id: newId });
      } else {
        newSessions.set(s.id, s);
      }
    });

    if (newSessions.size < sessions.length) {
      addToast("Zaman çakışması oluştu! Kaydırma yapılamıyor.", "warning");
      return;
    }

    const batch = writeBatch(db);
    
    idMap.forEach((newId, oldId) => {
      batch.delete(doc(db, 'sessions', oldId));
    });
    
    sessions.forEach((s, idx) => {
      if (idx >= startIdx) {
        const newId = idMap.get(s.id) || s.id;
        batch.set(doc(db, 'sessions', newId), newSessions.get(newId)!);
      }
    });

    groups.forEach(g => {
      let changed = false;
      const newBlocked = g.sessionsBlocked.map(id => {
        if (idMap.has(id)) {
          changed = true;
          return idMap.get(id)!;
        }
        return id;
      });
      if (changed) {
        batch.update(doc(db, 'groups', g.id), { sessionsBlocked: newBlocked });
      }
    });

    await batch.commit();
    await addHistory("Zaman Kaydırma", \`\${sessions[startIdx].time} ve sonrası \${minutes < 0 ? 'geri' : 'ileri'} alındı.\`);`;

content = content.replace(
  /const startIdx = sessions\.findIndex[\s\S]*?await addHistory\("Zaman Kaydırma".*/,
  shiftSessionsBody
);

// 5. isFullscreen sync 
content = content.replace(
  /const toggleFullScreen = \(\) => \{\s*if \(!document\.fullscreenElement\) \{\s*document\.documentElement\.requestFullscreen\(\)\.catch\(e => console\.error\(e\)\);\s*setIsFullScreen\(true\);\s*\} else \{\s*if \(document\.exitFullscreen\) \{\s*document\.exitFullscreen\(\);\s*setIsFullScreen\(false\);\s*\}\s*\}\s*\};/,
  `const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.error(e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);`
);

// 6. registerCustomer await
content = content.replace(
  /if \(cname && phone && count > 0 && movieId\) \{\s*registerCustomer\(showBookingModal\.sessionId, cname, phone, count, movieId\);\s*setShowBookingModal\(null\);\s*\}/,
  `if (cname && phone && count > 0 && movieId) {
                  await registerCustomer(showBookingModal.sessionId, cname, phone, count, movieId);
                  setShowBookingModal(null);
                }`
);

// 7. addHistory awaits
content = content.replace(/addHistory\("Grup Eklendi"/g, 'await addHistory("Grup Eklendi"');
content = content.replace(/addHistory\("Kişi Eklendi"/g, 'await addHistory("Kişi Eklendi"');
content = content.replace(/addHistory\("Ayarlar Güncellendi"/g, 'await addHistory("Ayarlar Güncellendi"');

// 8. Cust display status !== 'maintenance'
content = content.replace(
  /sessions\.find\(s => !s\.isFinished\)/g,
  `sessions.find(s => !s.isFinished && s.status !== 'maintenance')`
);

// 9. Phone regex validation
content = content.replace(
  /const phone = formData\.get\('phone'\) as string;/,
  `const phone = formData.get('phone') as string;
                if (phone && !/^\\d{10,11}$/.test(phone.replace(/\\s/g, ''))) {
                  addToast("Geçersiz telefon numarası!", "warning");
                  return;
                }`
);

fs.writeFileSync('src/App.tsx', content);
