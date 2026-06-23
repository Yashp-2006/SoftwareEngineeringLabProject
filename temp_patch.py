import re
from pathlib import Path

p = Path('client/src/app/setup/[id]/page.tsx')
c = p.read_text(encoding='utf-8')

c = c.replace(
    \"import EditCategoryModal from '@/components/EditCategoryModal';\",
    \"import EditCategoryModal from '@/components/EditCategoryModal';\nimport OnSpotEntryModal from '@/components/OnSpotEntryModal';\"
)

# We need to replace the old {modalType === 'onspot' && (...)} with the new component.
# The old one is very large, starts at {modalType === 'onspot' && ( and ends just before </div>\n          <div className=\"modal-footer\">
# Actually, since I extracted the entire modal content (header, body, footer), I can just remove the old 'onspot' condition from inside the main setup modal and place the new OnSpotEntryModal outside it.

# Let's find the large 'onspot' chunk inside the giant modal:
onspot_chunk = '''            {modalType === 'onspot' && (
              <>
                <div className=\"form-group\">
                  <label>Category</label>
                  <select className=\"input-field\" style={{ background: 'white' }} value={modalFormData.categoryId || ''} onChange={e => setModalFormData({...modalFormData, categoryId: e.target.value})}>
                    <option value=\"\">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className=\"form-group\">
                  <label>Athlete Name</label>
                  <input type=\"text\" className=\"input-field\" placeholder=\"e.g. John Doe\" value={modalFormData.athleteName || ''} onChange={e => setModalFormData({...modalFormData, athleteName: e.target.value})} />
                </div>
                <div className=\"form-group\">
                  <label>Academy / Club</label>
                  <input type=\"text\" className=\"input-field\" placeholder=\"e.g. Tokyo Karate Club\" value={modalFormData.academy || ''} onChange={e => setModalFormData({...modalFormData, academy: e.target.value})} />
                </div>
                <div className=\"form-group\">
                  <label>Country</label>
                  <input type=\"text\" className=\"input-field\" placeholder=\"e.g. India\" value={modalFormData.country || ''} onChange={e => setModalFormData({...modalFormData, country: e.target.value})} />
                </div>
                <div className=\"form-group\">
                  <label>State</label>
                  <input type=\"text\" className=\"input-field\" placeholder=\"e.g. Maharashtra\" value={modalFormData.state || ''} onChange={e => setModalFormData({...modalFormData, state: e.target.value})} />
                </div>
                <div className=\"form-group\">
                  <label>District</label>
                  <input type=\"text\" className=\"input-field\" placeholder=\"e.g. Pune\" value={modalFormData.district || ''} onChange={e => setModalFormData({...modalFormData, district: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className=\"form-group\" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Age</label>
                    <input type=\"number\" className=\"input-field\" placeholder=\"18\" value={modalFormData.age || ''} onChange={e => setModalFormData({...modalFormData, age: e.target.value})} />
                  </div>
                  <div className=\"form-group\" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Weight (kg)</label>
                    <input type=\"number\" className=\"input-field\" placeholder=\"75\" value={modalFormData.weight || ''} onChange={e => setModalFormData({...modalFormData, weight: e.target.value})} />
                  </div>
                  <div className=\"form-group\" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Gender</label>
                    <select className=\"input-field\" style={{ background: 'white' }} value={modalFormData.athleteGender || ''} onChange={e => setModalFormData({...modalFormData, athleteGender: e.target.value})}>
                      <option value=\"\">Any</option>
                      <option value=\"Male\">Male</option>
                      <option value=\"Female\">Female</option>
                    </select>
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px dashed var(--neutral-300)' }}>
                  <p className=\"text-small\" style={{ margin: 0, color: 'var(--neutral-500)' }}>
                    <strong>On-Spot Entry:</strong> This athlete will be added directly to the selected category. The tiesheet will need to be regenerated to include them.
                  </p>
                </div>
              </>
            )}'''
c = c.replace(onspot_chunk, '')

# Now let's remove the save handler logic for onspot
onspot_save = '''              } else if (modalType === 'onspot' && modalFormData.athleteName && modalFormData.categoryId) {
                try {
                  const { db } = await import('@lib/firebase');
                  const { doc, setDoc, updateDoc, increment } = await import('firebase/firestore');
                  
                  const athleteId = onspot-;
                  const athleteData = {
                    name: modalFormData.athleteName.trim(),
                    academy: modalFormData.academy?.trim() || '',
                    country: modalFormData.country?.trim() || '',
                    state: modalFormData.state?.trim() || '',
                    district: modalFormData.district?.trim() || '',
                    age: modalFormData.age ? parseInt(modalFormData.age) : null,
                    weight: modalFormData.weight ? parseFloat(modalFormData.weight) : null,
                    gender: modalFormData.athleteGender || 'Any',
                    categoryId: modalFormData.categoryId,
                    isOnSpot: true,
                    createdAt: new Date().toISOString(),
                  };

                  await setDoc(doc(db, 'competitions', id, 'athletes', athleteId), athleteData);
                  
                  // Increment the category entries count
                  const catRef = doc(db, 'competitions', id, 'categories', modalFormData.categoryId);
                  await updateDoc(catRef, { entries: increment(1) }).catch(() => {
                    // If the category doc doesn't exist yet, create it
                    setDoc(catRef, { entries: 1 }, { merge: true });
                  });

                  // Also update local state
                  setCategories(prev => prev.map(c => c.id === modalFormData.categoryId ? { ...c, entries: (c.entries || 0) + 1 } : c));
                  
                  toast.success(${modalFormData.athleteName} added on-spot to !);
                } catch (err) {
                  console.error('On-spot entry failed:', err);
                  toast.error('Failed to add on-spot entry.');
                }'''
c = c.replace(onspot_save, '')

# And insert the new component at the end
new_modal = '''      {modalType === 'onspot' && (
        <OnSpotEntryModal
          competitionId={id}
          categories={categories}
          onClose={() => setModalType(null)}
          onSuccess={(catId) => {
             setCategories(prev => prev.map(c => c.id === catId ? { ...c, entries: (c.entries || 0) + 1 } : c));
          }}
        />
      )}
'''
c = c.replace(\"{modalType === 'editCategory'\", new_modal + \"\n      {modalType === 'editCategory'\")

p.write_text(c, encoding='utf-8')
print('Modifications applied successfully.')
