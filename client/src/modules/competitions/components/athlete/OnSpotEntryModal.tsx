'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface OnSpotEntryModalProps {
  competitionId: string;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSuccess?: (categoryId: string) => void;
}

export default function OnSpotEntryModal({ competitionId, categories, onClose, onSuccess }: OnSpotEntryModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.athleteName || !formData.categoryId) {
      toast.error('Athlete name and category are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { db } = await import('@lib/firebase');
      const { doc, setDoc, updateDoc, increment } = await import('firebase/firestore');
      
      const athleteId = `onspot-${Date.now()}`;
      const athleteData = {
        name: formData.athleteName.trim(),
        academy: formData.academy?.trim() || '',
        country: formData.country?.trim() || '',
        state: formData.state?.trim() || '',
        district: formData.district?.trim() || '',
        age: formData.age ? parseInt(formData.age) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        gender: formData.athleteGender || 'Any',
        categoryId: formData.categoryId,
        isOnSpot: true,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'competitions', competitionId, 'athletes', athleteId), athleteData);
      
      const catRef = doc(db, 'competitions', competitionId, 'categories', formData.categoryId);
      await updateDoc(catRef, { entries: increment(1) }).catch(() => {
        setDoc(catRef, { entries: 1 }, { merge: true });
      });

      toast.success(`${formData.athleteName} added on-spot!`);
      if (onSuccess) onSuccess(formData.categoryId);
      onClose();
    } catch (err) {
      console.error('On-spot entry failed:', err);
      toast.error('Failed to add on-spot entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '600px', width: '90vw' }}>
        <div className="modal-header">
          <h2>On-Spot Registration</h2>
          <button className="btn-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '24px' }}>
          
          <div className="form-group">
            <label>Category</label>
            <select className="input-field" style={{ background: 'white' }} value={formData.categoryId || ''} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Athlete Name</label>
            <input type="text" className="input-field" placeholder="e.g. John Doe" value={formData.athleteName || ''} onChange={e => setFormData({...formData, athleteName: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Academy / Club</label>
            <input type="text" className="input-field" placeholder="e.g. Tokyo Karate Club" value={formData.academy || ''} onChange={e => setFormData({...formData, academy: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Country</label>
            <input type="text" className="input-field" placeholder="e.g. India" value={formData.country || ''} onChange={e => setFormData({...formData, country: e.target.value})} />
          </div>
          <div className="form-group">
            <label>State</label>
            <input type="text" className="input-field" placeholder="e.g. Maharashtra" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} />
          </div>
          <div className="form-group">
            <label>District</label>
            <input type="text" className="input-field" placeholder="e.g. Pune" value={formData.district || ''} onChange={e => setFormData({...formData, district: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Age</label>
              <input type="number" className="input-field" placeholder="18" value={formData.age || ''} onChange={e => setFormData({...formData, age: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Weight (kg)</label>
              <input type="number" className="input-field" placeholder="75" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Gender</label>
              <select className="input-field" style={{ background: 'white' }} value={formData.athleteGender || ''} onChange={e => setFormData({...formData, athleteGender: e.target.value})}>
                <option value="">Any</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div style={{ padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px dashed var(--neutral-300)' }}>
            <p className="text-small" style={{ margin: 0, color: 'var(--neutral-500)' }}>
              <strong>On-Spot Entry:</strong> This athlete will be added directly to the selected category. The tiesheet will need to be regenerated to include them.
            </p>
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Confirm Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
