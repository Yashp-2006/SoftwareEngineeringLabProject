'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Save, CheckCircle, Combine, Plus, Edit2, Trash2, Star, FileSpreadsheet, RefreshCw, Key, ChevronDown, Eye, EyeOff, UploadCloud, X, Download } from 'lucide-react';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';
import { toast } from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function SetupWizard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [activePhase, setActivePhase] = useState(1);
  const [highestPhase, setHighestPhase] = useState(1);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [matsCount, setMatsCount] = useState(8);
  const [poolSize, setPoolSize] = useState<4|8|16|32>(8);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});
  const [matPasswordMap, setMatPasswordMap] = useState<Record<number, string>>({});
  const [deploying, setDeploying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<{categoriesTotal: number; athletesImported: number} | null>(null);
  const [generatingSpecialCatId, setGeneratingSpecialCatId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'standard'|'special'|'merge'|null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewCatId, setPreviewCatId] = useState<string | null>(null);
  const [downloadingTiesheets, setDownloadingTiesheets] = useState(false);
  const [modalFormData, setModalFormData] = useState<any>({});
  const [compName, setCompName] = useState<string>('Loading...');
  const [compVenue, setCompVenue] = useState<string>('');
  const [compDate, setCompDate] = useState<string>('');
  
  const [compRules, setCompRules] = useState<string>('');
  const [compType, setCompType] = useState<string>('international');
  const [wkfMode, setWkfMode] = useState<string>('standard');
  const [categories, setCategories] = useState<any[]>([]);
  const [specialCategories, setSpecialCategories] = useState<any[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const [filterGender, setFilterGender] = useState<'all'|'male'|'female'>('all');
  const [hideEmpty, setHideEmpty] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; title: string; message: string; isDestructive: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', isDestructive: false, onConfirm: () => {} });

  const closeConfirm = () => setConfirmState(prev => ({ ...prev, isOpen: false }));

  const saveDraft = async (targetPhase: number) => {
    setIsSaving(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@lib/firebase');

      // Firestore rejects `undefined` values — strip them out recursively
      const stripUndefined = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(stripUndefined);
        if (obj !== null && typeof obj === 'object') {
          const clean: any = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) clean[k] = stripUndefined(v);
          }
          return clean;
        }
        return obj;
      };

      await setDoc(doc(db, 'competitions', id, 'drafts', 'setup'), stripUndefined({
        compName,
        matsCount,
        poolSize,
        compRules,
        compType,
        wkfMode,
        categories,
        specialCategories,
        importResult: importResult ?? null,
        lastActivePhase: targetPhase,
        highestPhase: Math.max(highestPhase, targetPhase),
        updatedAt: new Date().toISOString()
      }), { merge: true });
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setIsSaving(false);
    }
  };


  const isInitialMount = React.useRef(true);

  useEffect(() => {
    if (!isDataLoaded) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveDraft(activePhase);
    }, 1500);
    return () => clearTimeout(timer);
  }, [compName, matsCount, poolSize, compRules, compType, wkfMode, categories, specialCategories, importResult, activePhase, highestPhase, isDataLoaded]);

  const handleWkfModeChange = async (mode: string) => {
    setWkfMode(mode);
    const { generateWkfCategories } = await import('@lib/wkf-categories');
    setCategories(generateWkfCategories(mode).map(name => ({ id: name, name, entries: 0 })));
  };

  useEffect(() => {
    const fetchComp = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@lib/firebase');
        
        // Load main doc for Name, Venue, Date
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists()) {
          const mainData = snap.data();
          setCompName(mainData.name || 'Untitled Tournament');
          if (mainData.venue) setCompVenue(mainData.venue);
          if (mainData.startDate) {
            const startDate = new Date(mainData.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            const endDate = mainData.endDate ? new Date(mainData.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
            setCompDate(endDate && startDate !== endDate ? `${startDate} - ${endDate}` : startDate);
          }
        }

        // Try to load draft first
        const draftSnap = await getDoc(doc(db, 'competitions', id, 'drafts', 'setup'));
        if (draftSnap.exists()) {
          const draftData = draftSnap.data();
          if (draftData.compName && draftData.compName !== 'Loading...') setCompName(draftData.compName);
          if (draftData.matsCount !== undefined) setMatsCount(draftData.matsCount);
          if (draftData.poolSize !== undefined) setPoolSize(draftData.poolSize);
          if (draftData.compRules !== undefined) setCompRules(draftData.compRules);
          if (draftData.compType !== undefined) setCompType(draftData.compType);
          if (draftData.wkfMode !== undefined) setWkfMode(draftData.wkfMode);
          if (draftData.categories !== undefined) setCategories(draftData.categories);
          if (draftData.specialCategories !== undefined) setSpecialCategories(draftData.specialCategories);
          if (draftData.importResult !== undefined) setImportResult(draftData.importResult);
          if (draftData.highestPhase !== undefined) setHighestPhase(draftData.highestPhase);
          else if (draftData.lastActivePhase !== undefined) setHighestPhase(draftData.lastActivePhase);
          if (draftData.lastActivePhase !== undefined) setActivePhase(draftData.lastActivePhase);
          
          setIsDataLoaded(true);
          return;
        }

        if (snap.exists()) {
          const data = snap.data();
          setCompRules(data.rules);
          setCompType(data.type || 'international');
          if (data.mats !== undefined) setMatsCount(data.mats);
          
          if (data.rules === 'wkf') {
            const { generateWkfCategories } = await import('@lib/wkf-categories');
            const { collection, getDocs } = await import('firebase/firestore');
            const catSnap = await getDocs(collection(db, 'competitions', id, 'categories'));
            
            const existingEntries = new Map<string, number>();
            catSnap.docs.forEach(doc => {
              existingEntries.set(doc.data().name, doc.data().entries || 0);
            });
            
            setCategories(generateWkfCategories(wkfMode).map(name => ({ 
              id: name, 
              name, 
              entries: existingEntries.get(name) || 0 
            })));
          }
          setIsDataLoaded(true);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchComp();
  }, [id]);

  const toggleCategorySelection = (catId: string) => {
    const newSet = new Set(selectedCats);
    if (newSet.has(catId)) newSet.delete(catId);
    else newSet.add(catId);
    setSelectedCats(newSet);
  };

  const handleMerge = () => {
    if (selectedCats.size < 2) {
      toast.error("Select at least 2 categories to merge.");
      return;
    }
    setModalFormData({ name: Array.from(selectedCats).join(' / ') });
    setModalType('merge');
  };

  const togglePassword = (idx: number) => {
    setShowPasswordMap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const saveMatPassword = async (idx: number, password: string) => {
    const matId = `mat-${idx + 1}`;
    try {
      const { db } = await import('@lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(
        doc(db, 'competitions', id, 'mats', matId),
        { password },
        { merge: true }
      );
      toast.success(`Password saved for Mat ${String(idx + 1).padStart(2, '0')}`);
    } catch (err) {
      console.error('Failed to save mat password', err);
      toast.error('Failed to save password.');
    }
  };

  const maxPhase = compRules === 'wkf' ? 5 : 6;

  const handleNext = () => {
    if (activePhase < maxPhase) {
      const next = activePhase + 1;
      setHighestPhase(prev => Math.max(prev, next));
      setActivePhase(next);
      saveDraft(next);
    }
  };
  const handleBack = () => {
    if (activePhase > 1) {
      const prev = activePhase - 1;
      setActivePhase(prev);
      saveDraft(prev);
    }
  };

  const setPhase = (p: number) => {
    if (p <= highestPhase || isReviewMode) {
      setActivePhase(p);
      saveDraft(p);
      if (p < maxPhase) setIsReviewMode(false);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('compType', compType);
      formData.append('poolSize', poolSize.toString());
      formData.append('specialCategories', JSON.stringify(specialCategories));
      formData.append('customCategories', compRules !== 'wkf' ? JSON.stringify(categories) : '[]');
      formData.append('wkfMode', wkfMode);
      
      const res = await fetch(`/api/competitions/${id}/import`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        setImportResult({ categoriesTotal: data.categoriesTotal, athletesImported: data.athletesImported });
        if (data.categories) {
          setCategories(prev => {
            const merged = [...prev];
            data.categories.forEach((importedCat: any) => {
              const existingIdx = merged.findIndex(c => c.name === importedCat.name);
              if (existingIdx >= 0) {
                merged[existingIdx] = { ...merged[existingIdx], entries: importedCat.entries };
              } else {
                merged.push(importedCat);
              }
            });
            return merged;
          });
        }
        toast.success('Upload Successful!');
        setTimeout(() => {
          setHighestPhase(prev => Math.max(prev, 2));
          setPhase(2);
        }, 2000);
      } else {
        toast.error('Error: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload and generate tiesheet.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTiesheets = async () => {
    if (downloadingTiesheets) return;
    setDownloadingTiesheets(true);
    try {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'competitions', id, 'categories'));
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      if (cats.length === 0) {
        toast.error('No categories found. Import athletes first.');
        return;
      }
      const { exportTiesheetsPDF } = await import('@lib/tiesheet-pdf-exporter');
      await exportTiesheetsPDF({
        competitionName: compName,
        categories: cats.map((c: any) => ({
          name: c.name,
          matches: c.matches ?? [],
          athletes: c.athletes ?? [],
          matNo: c.mat || '',
        })),
        isArchived: false,
        venue: compVenue,
        date: compDate,
      });
      toast.success('Tiesheets PDF downloaded!');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to generate tiesheets: ' + e.message);
    } finally {
      setDownloadingTiesheets(false);
    }
  };

  const handleGenerateSpecialTiesheet = (specialCatId: string, specialCatName: string) => {

    setConfirmState({
      isOpen: true,
      title: 'Generate Special Tiesheet',
      message: `Generate tiesheet for "${specialCatName}" from completed standard categories?`,
      isDestructive: false,
      onConfirm: async () => {
        closeConfirm();
        setGeneratingSpecialCatId(specialCatId);
        try {
          const res = await fetch(`/api/competitions/${id}/brackets/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ specialCategoryId: specialCatId, poolSize, compType }),
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Special category tiesheet ready! ${data.athletesSeeded} athletes seeded.`);
            setPreviewCatId(specialCatId);
            setPreviewModalOpen(true);
          } else {
            toast.error('Error: ' + data.error);
          }
        } catch (err) {
          console.error(err);
          toast.error('Failed to generate special category tiesheet.');
        } finally {
          setGeneratingSpecialCatId(null);
        }
      }
    });
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const { db } = await import('@lib/firebase');
      const { writeBatch, doc, collection, getDocs } = await import('firebase/firestore');
      
      const catsSnapshot = await getDocs(collection(db, 'competitions', id, 'categories'));
      const existingCatsMap: Record<string, any> = {};
      catsSnapshot.docs.forEach(d => {
        existingCatsMap[d.data().name] = d.ref;
      });

      const batch = writeBatch(db);
      
      const allCats = [
        ...categories.filter(c => hideEmpty ? (c.entries || 0) > 0 : true).map(c => ({...c, isSpecial: false})),
        ...specialCategories.map(c => ({...c, isSpecial: true}))
      ];
      const numMats = (matsCount as number) || 1;
      
      // --- Read timing config from competition doc ---
      const { getDoc } = await import('firebase/firestore');
      const compDocSnap = await getDoc(doc(db, 'competitions', id));
      const compDocData = compDocSnap.exists() ? compDocSnap.data() : {};

      // Parse start time (e.g. '09:00') into total minutes
      const parseTimeMins = (t: string) => {
        if (!t) return 9 * 60; // default 09:00
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
      };
      const configStartMins = parseTimeMins(compDocData.startTime || '09:00');
      const configEstMins = parseInt(compDocData.estMinsPerCategory) || 0;

      // Auto-distribute evenly across mats starting at configStartMins
      // Use total minutes from midnight to avoid hour overflow
      const matTotalMins = Array.from({ length: numMats }).map(() => configStartMins);
      
      allCats.forEach((cat, index) => {
        const matIndex = index % numMats;
        const matName = `MAT ${String(matIndex + 1).padStart(2, '0')}`;
        // Use configEstMins if set, otherwise fall back to entries-based estimate
        const estimatedDuration = configEstMins > 0
          ? configEstMins
          : Math.min((cat.entries || 1) * 2, 90);
        
        const startTotalMins = matTotalMins[matIndex];
        const endTotalMins = startTotalMins + estimatedDuration;
        matTotalMins[matIndex] = endTotalMins;

        const fmtTime = (totalMins: number) => {
          const h = Math.floor(totalMins / 60) % 24;
          const m = totalMins % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        const startTimeStr = fmtTime(startTotalMins);
        const endTimeStr = fmtTime(endTotalMins);
        
        const catRef = existingCatsMap[cat.name] || doc(collection(db, 'competitions', id, 'categories'));
        
        const updateData: any = {
          name: cat.name,
          entries: cat.entries || 0,
          status: 'upcoming',
          mat: matName,
          estimatedDuration: estimatedDuration,
          scheduledStartTime: startTimeStr,
          scheduledEndTime: endTimeStr,
          order: index,
          isSpecial: cat.isSpecial
        };
        
        if (cat.isSpecial) {
          if (cat.medal !== undefined) updateData.medal = cat.medal;
          if (cat.minAge !== undefined) updateData.minAge = cat.minAge;
          if (cat.maxAge !== undefined) updateData.maxAge = cat.maxAge;
          if (cat.minWeight !== undefined) updateData.minWeight = cat.minWeight;
          if (cat.maxWeight !== undefined) updateData.maxWeight = cat.maxWeight;
        }

        if (existingCatsMap[cat.name]) {
          batch.update(catRef, updateData);
        } else {
          batch.set(catRef, updateData);
        }
      });

      // Auto-seed mats matching matsCount
      for (let i = 1; i <= numMats; i++) {
        const matRef = doc(db, 'competitions', id, 'mats', `mat-${i}`);
        batch.set(matRef, { name: `MAT ${String(i).padStart(2, '0')}`, order: i }, { merge: true });
      }
      
      batch.update(doc(db, 'competitions', id), {
        name: compName,
        mats: matsCount,
        status: 'live',
        deployedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      await batch.commit();
      toast.success("Deployment successful! Schedule generated and saved.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to deploy tournament.");
    } finally {
      setDeploying(false);
    }
  };

  // Note: handleFinalize no longer needed — categories are saved by the API on import

  const filteredCategories = categories.filter(c => {
    if (hideEmpty && (!c.entries || c.entries === 0)) return false;
    const lowerName = c.name.toLowerCase();
    if (filterGender === 'female' && !lowerName.includes('female')) return false;
    if (filterGender === 'male' && (!lowerName.includes('male') || lowerName.includes('female'))) return false;
    return true;
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .setup-grid { display: flex; flex-direction: column; gap: var(--space-5); }
        .wizard-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); flex-wrap: wrap; }
        .wizard-stepper { display: grid; grid-template-columns: repeat(var(--stepper-cols, 5), minmax(0, 1fr)); gap: var(--space-3); }
        .wizard-step { border: 1px solid var(--neutral-300); background: var(--shiro); padding: 12px 14px; border-radius: 10px; text-align: left; cursor: pointer; transition: all 0.2s; }
        .wizard-step:hover:not(:disabled) { border-color: var(--neutral-400); transform: translateY(-1px); }
        .wizard-step:disabled { opacity: 0.5; cursor: not-allowed; }
        .wizard-step-number { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 999px; background: var(--neutral-100); color: var(--neutral-600); font-weight: 700; font-size: 12px; margin-bottom: 6px; }
        .wizard-step.active:not(:disabled) { border-color: var(--ao); box-shadow: 0 6px 18px rgba(39, 122, 255, 0.15); }
        .wizard-step.active .wizard-step-number { background: var(--ao); color: var(--shiro); }
        .wizard-step.completed:not(:disabled) { border-color: var(--neutral-200); background: var(--neutral-50); }
        .wizard-step-label { font-size: 13px; font-weight: 600; color: var(--neutral-800); }
        .review-banner { background: var(--neutral-50); border: 1px dashed var(--neutral-300); border-radius: 14px; padding: var(--space-5); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
        .phase-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-4); }
        .wizard-actions { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--neutral-200); }
        .pool-size-options { display: flex; gap: var(--space-3); flex-wrap: wrap; }
        .pool-size-option { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
        .pool-size-option input { display: none; }
        .pool-size-option span { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; height: 40px; border-radius: 999px; border: 1px solid var(--neutral-300); background: var(--shiro); font-weight: 600; }
        .pool-size-option input:checked + span { background: var(--ao); color: var(--shiro); border-color: var(--ao); }
        .tiesheet-preview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4); margin-top: var(--space-4); }
        .category-manager { display: flex; flex-direction: column; gap: var(--space-6); }
        .cat-group { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-5); }
        .cat-table { width: 100%; border-collapse: collapse; margin-top: var(--space-4); }
        .cat-table th { text-align: left; padding: 12px; border-bottom: 2px solid var(--neutral-100); }
        .cat-table td { padding: 12px; border-bottom: 1px solid var(--neutral-100); }
        .dropzone { border: 2px dashed var(--neutral-300); border-radius: 12px; padding: var(--space-8); text-align: center; background: var(--neutral-50); transition: all 0.2s; cursor: pointer; }
        .dropzone:hover { border-color: var(--ao); background: var(--ao-light); }
        .mat-setup-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4); }
        .mat-setup-card { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-4); }
        .mat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
        .mat-number-badge { font-family: var(--font-display); font-size: 20px; color: var(--neutral-900); }
        .password-input-group { position: relative; }
        .password-input-group input { width: 100%; height: 40px; border: 1.5px solid var(--neutral-300); border-radius: 8px; padding: 0 40px 0 12px; font-family: var(--font-mono); font-size: 14px; outline: none; }
        .password-input-group input:focus { border-color: var(--ao); }
        .toggle-password { position: absolute; right: 12px; top: 10px; color: var(--neutral-400); cursor: pointer; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 13px; font-weight: 600; color: var(--neutral-700); }
        .input-field { width: 100%; height: 40px; padding: 0 12px; border: 1.5px solid var(--neutral-300); border-radius: 8px; font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.2s; background: var(--shiro); }
        .input-field:focus { border-color: var(--ao); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .modal-overlay.active { display: flex; }
        .modal { background: var(--shiro); border-radius: 16px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
        .modal-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--neutral-200); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--neutral-500); padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .close-btn:hover { background: var(--neutral-100); color: var(--neutral-800); }
        .modal-body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
        .modal-footer { padding: var(--space-4) var(--space-5); border-top: 1px solid var(--neutral-200); display: flex; justify-content: flex-end; gap: var(--space-3); background: var(--neutral-50); border-radius: 0 0 16px 16px; }
        @media (max-width: 1100px) { .wizard-stepper { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 700px) { .wizard-stepper { grid-template-columns: 1fr; } }
      `}} />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">{compName} / Setup</div>
            <h1>Tournament Setup Wizard</h1>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary" onClick={() => saveDraft(activePhase)} disabled={isSaving}>
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button className="btn btn-primary" onClick={handleDeploy} disabled={!importResult}>
              <CheckCircle size={16} /> Finalize Setup
            </button>
          </div>
        </header>

        <div className="setup-grid">
          <div className="wizard-header">
            <div>
              <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Setup Wizard</div>
              <h2 style={{ margin: 0 }}>Guided Tournament Setup</h2>
              <p className="text-small" style={{ marginTop: '4px' }}>Move through five phases and skip straight to review if you already know what to fix.</p>
            </div>
            <div>
              <button className="btn btn-ghost" onClick={() => { setIsReviewMode(true); setActivePhase(maxPhase); }}>
                Skip to Review <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </button>
            </div>
          </div>

          <div className="wizard-stepper" style={{ '--stepper-cols': maxPhase } as React.CSSProperties}>
            {(compRules === 'wkf' 
              ? ['Roster Import', 'Categories & Mats', 'Tiesheet Preview', 'Staff & Security', 'Review']
              : ['Define Categories', 'Roster Import', 'Mat Setup', 'Tiesheet Preview', 'Staff & Security', 'Review']
            ).map((label, idx) => {
              const phaseNum = idx + 1;
              const isCompleted = highestPhase > phaseNum || isReviewMode;
              const isActive = activePhase === phaseNum;
              return (
                <button
                  key={phaseNum}
                  className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  onClick={() => setPhase(phaseNum)}
                  disabled={!isCompleted && highestPhase < phaseNum}
                >
                  <div className="wizard-step-number">
                    {isCompleted && !isActive ? <CheckCircle size={14} /> : phaseNum}
                  </div>
                  <div className="wizard-step-label">{label}</div>
                </button>
              );
            })}
          </div>

          <div className="wizard-actions">
            <div className="text-small">Step {activePhase} of {maxPhase}</div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" disabled={activePhase === 1} onClick={handleBack}>Back</button>
              <button className="btn btn-primary" disabled={activePhase === maxPhase} onClick={handleNext}>Next</button>
            </div>
          </div>

          {((activePhase === maxPhase) || isReviewMode) && (
            <section className="wizard-phase active">
              <div className="review-banner">
                <div>
                  <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Phase {maxPhase}</div>
                  <h3 style={{ margin: 0 }}>Review & Edit Everything</h3>
                  <p className="text-small" style={{ marginTop: '4px' }}>All sections are unlocked. Edit any step and the tiesheet preview will flag for regeneration.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" onClick={() => setPhase(4)}>Return to Step 4</button>
                  <button className="btn btn-primary" disabled={deploying} onClick={handleDeploy}>
                    {deploying ? 'Deploying...' : 'Deploy Tournament'}
                  </button>
                </div>
              </div>
              <div className="category-manager" style={{ marginTop: 'var(--space-4)' }}>
                <div className="cat-group">
                  <h3>Tournament Profile</h3>
                  <p className="text-small mb-4">Basic information about the event.</p>
                  <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Tournament Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={compName} 
                      onChange={e => setCompName(e.target.value)} 
                      style={{ marginBottom: 0 }} 
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {((compRules === 'wkf' && activePhase === 1) || (compRules !== 'wkf' && activePhase === 2) || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase {compRules === 'wkf' ? '1' : '2'} — Match Pool Size + Excel Import</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Choose a pool size and import athletes to generate tiesheets.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                <div className="cat-group">
                  <h3>Match Pool Size</h3>
                  <p className="text-small">Pick a standard pool size. Max supported size is 32.</p>
                  <div className="pool-size-options" style={{ marginTop: 'var(--space-4)' }}>
                    {([4, 8, 16, 32] as const).map(size => (
                      <label key={size} className="pool-size-option">
                        <input type="radio" name="pool-size" value={size} checked={poolSize === size} onChange={() => setPoolSize(size)} />
                        <span>{size}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {compRules === 'wkf' && (
                  <div className="cat-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ padding: 'var(--space-3)', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px solid var(--neutral-200)' }}>
                      <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: '13px' }}>WKF Categorization Mode</h4>
                      <p className="text-small" style={{ marginBottom: 'var(--space-3)', color: 'var(--neutral-600)' }}>Choose this before importing. How should categories be formatted?</p>
                      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input type="radio" name="wkfMode" value="standard" checked={wkfMode === 'standard'} onChange={() => handleWkfModeChange('standard')} />
                          <span className="text-small">Standard (Age & Weight)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input type="radio" name="wkfMode" value="age" checked={wkfMode === 'age'} onChange={() => handleWkfModeChange('age')} />
                          <span className="text-small">Age Wise Only</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input type="radio" name="wkfMode" value="weight" checked={wkfMode === 'weight'} onChange={() => handleWkfModeChange('weight')} />
                          <span className="text-small">Weight Wise Only</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="cat-group">
                  <div className="flex-between mb-4">
                    <div>
                      <h3>Tiesheet Data Import</h3>
                      <p className="text-small">Upload your CSV or Excel files to automatically generate brackets.</p>
                    </div>
                  </div>

                  <div className="dropzone" onClick={() => document.getElementById('excel-upload')?.click()}>
                    {importResult ? (
                      <>
                        <CheckCircle className="dropzone-icon" style={{ color: 'var(--midori, #10b981)' }} />
                        <h3 style={{ color: 'var(--midori, #10b981)' }}>Upload Successful!</h3>
                        <p className="text-small" style={{ marginBottom: 'var(--space-4)' }}>
                          {importResult.categoriesTotal} categories, {importResult.athletesImported} athletes imported.
                        </p>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="dropzone-icon" />
                        <h3>Drag & drop your registration file here</h3>
                        <p className="text-small" style={{ marginBottom: 'var(--space-4)' }}>Supports .csv, .xls, .xlsx (Max 10MB)</p>
                      </>
                    )}
                    <button className="btn btn-primary" disabled={uploading}>
                      {uploading ? 'Processing...' : importResult ? 'Upload Another File' : 'Browse Files'}
                    </button>
                    <input type="file" id="excel-upload" style={{ display: 'none' }} accept=".csv, .xls, .xlsx" onChange={handleFileUpload} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {((compRules === 'wkf' && activePhase === 2) || (compRules !== 'wkf' && activePhase === 1) || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>{compRules === 'wkf' ? 'Phase 2 — Categories + Mats' : 'Phase 1 — Define Categories'}</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Define divisions for the tournament.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                {compRules === 'wkf' && (
                <div className="cat-group">
                  <div className="flex-between">
                    <div>
                      <h3>Mats & Capacity</h3>
                      <p className="text-small">The mat count drives score operator assignments and security setup.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', marginTop: 'var(--space-4)' }}>
                    <div style={{ flex: 1 }}>
                      <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Total Active Mats</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={matsCount} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            setMatsCount('' as any);
                          } else {
                            const parsed = parseInt(val);
                            setMatsCount(isNaN(parsed) ? 1 : Math.min(20, Math.max(1, parsed)));
                          }
                        }} 
                        onBlur={() => {
                          if (!matsCount || isNaN(matsCount as number) || (matsCount as number) < 1) {
                            setMatsCount(1);
                          }
                        }}
                        min="1" 
                        max="20" 
                        style={{ marginBottom: 0 }} 
                      />
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ height: '44px', padding: '0 24px' }} 
                      onClick={() => {
                        if (!matsCount || (matsCount as number) < 1) setMatsCount(1);
                        toast.success(`Capacity successfully updated to ${matsCount || 1} mats!`);
                      }}
                    >Apply Capacity</button>
                  </div>
                </div>
                )}

                <div className="cat-group">
                  <div className="flex-between">
                    <div>
                      <h3>Standard Categories</h3>
                      <p className="text-small">Generic weight and age divisions without complex prerequisite rules.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      {compRules === 'wkf' ? (
                        <button className="btn btn-secondary" onClick={handleMerge} disabled={selectedCats.size < 2}>
                          <Combine size={16} /> Merge Selected
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-ghost" onClick={() => setModalType('merge')}>
                            <Combine size={16} /> Merge Categories
                          </button>
                          <button className="btn btn-secondary" onClick={() => setModalType('standard')}>
                            <Plus size={16} /> Add Standard
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '16px', marginBottom: '16px' }}>
                    <select className="input-field" style={{ width: '180px', height: '36px', marginBottom: 0 }} value={filterGender} onChange={e => setFilterGender(e.target.value as any)}>
                      <option value="all">All Genders</option>
                      <option value="male">Male Categories</option>
                      <option value="female">Female Categories</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--neutral-700)' }}>
                      <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
                      Hide 0 Entries
                    </label>
                  </div>

                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="cat-table">
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--shiro)', zIndex: 10 }}>
                        <tr>
                          {compRules === 'wkf' && <th style={{ width: '40px' }}></th>}
                          <th>Category Name</th>
                          <th>Discipline</th>
                          <th>Requirements</th>
                          <th>Entries</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCategories.map((cat, idx) => (
                          <tr key={cat.id || idx}>
                            {compRules === 'wkf' && (
                              <td>
                                <input 
                                  type="checkbox" 
                                  checked={selectedCats.has(cat.id)}
                                  onChange={() => toggleCategorySelection(cat.id)}
                                />
                              </td>
                            )}
                            <td style={{ fontWeight: 500 }}>{cat.name}</td>
                            <td>
                              {compRules !== 'wkf' && (
                                <span className="status-chip status-live" style={{ background: cat.discipline === 'Kata' ? '#eff6ff' : '#fff1f2', color: cat.discipline === 'Kata' ? '#1d4ed8' : '#be123c', fontSize: '10px', padding: '2px 6px', marginRight: '4px', borderRadius: '4px', fontWeight: 700 }}>
                                  {cat.discipline || 'Kumite'}
                                </span>
                              )}
                            </td>
                            <td>
                              {compRules !== 'wkf' ? (
                                <>
                                  {cat.gender && cat.gender !== 'Any' && <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>{cat.gender}</span>}
                                  {(cat.minAge !== undefined || cat.maxAge !== undefined) && <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>Age: {cat.minAge || 0}-{cat.maxAge || 99}</span>}
                                  {(cat.minWeight !== undefined || cat.maxWeight !== undefined) && <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>Weight: {cat.minWeight || 0}-{cat.maxWeight || 300}kg</span>}
                                </>
                              ) : (
                                <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>Standard</span>
                              )}
                            </td>
                            <td>{cat.entries}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-ghost" style={{ padding: '4px' }}><Edit2 size={16} /></button>
                              <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--aka)' }} onClick={() => setCategories(categories.filter(c => c.id !== cat.id))}><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                        {filteredCategories.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--neutral-500)', padding: 'var(--space-6)' }}>
                              No categories found matching filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Special Categories are created in the live competition (Bracket/Tiesheet page) */}
              </div>
            </section>
          )}

          {(compRules !== 'wkf' && (activePhase === 3 || isReviewMode)) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 3 — Mat Setup</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Set how many mats will be active for the tournament.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                  <div className="cat-group">
                    <div className="flex-between">
                      <div>
                        <h3>Mats & Capacity</h3>
                        <p className="text-small">The mat count drives score operator assignments and security setup.</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', marginTop: 'var(--space-4)' }}>
                      <div style={{ flex: 1 }}>
                        <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Total Active Mats</label>
                        <input 
                          type="number" 
                          className="input-field" 
                          value={matsCount} 
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '') {
                              setMatsCount('' as any);
                            } else {
                              const parsed = parseInt(val);
                              setMatsCount(isNaN(parsed) ? 1 : Math.min(20, Math.max(1, parsed)));
                            }
                          }} 
                          onBlur={() => {
                            if (!matsCount || isNaN(matsCount as number) || (matsCount as number) < 1) {
                              setMatsCount(1);
                            }
                          }}
                          min="1" 
                          max="20" 
                          style={{ marginBottom: 0 }} 
                        />
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        style={{ height: '44px', padding: '0 24px' }} 
                        onClick={() => {
                          if (!matsCount || (matsCount as number) < 1) setMatsCount(1);
                          toast.success(`Capacity successfully updated to ${matsCount || 1} mats!`);
                        }}
                      >Apply Capacity</button>
                    </div>
                  </div>
              </div>
            </section>
          )}

          {((compRules === 'wkf' && activePhase === 3) || (compRules !== 'wkf' && activePhase === 4) || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase {compRules === 'wkf' ? '3' : '4'} — Tiesheet Generation Preview</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Tiesheets are generated on import. Preview verifies first-round matchups.</p>
                  </div>
                </div>
              )}
              <div className="cat-group">
                <p className="text-small">Pool size: {poolSize} (configured in Phase 2)</p>
                {!importResult && categories.length === 0 && specialCategories.length === 0 ? (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px dashed var(--neutral-300)' }}>
                    <p style={{ color: 'var(--neutral-500)' }}>No categories defined yet. Please upload an Excel file in Phase 1 or create categories manually.</p>
                  </div>
                ) : (
                  <div className="mat-setup-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0' }}>{importResult ? importResult.categoriesTotal : (categories.length + specialCategories.length)} Categories Generated</h4>
                      <p className="text-small" style={{ color: 'var(--neutral-500)', margin: 0 }}>
                        {importResult ? importResult.athletesImported : 'N/A'} Athletes {importResult ? 'Imported' : ''} • Pool size: {poolSize}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={handleDownloadTiesheets}
                        disabled={downloadingTiesheets || (!importResult && categories.length === 0)}
                      >
                        <Download size={16} style={{ marginRight: '6px' }} />
                        {downloadingTiesheets ? 'Generating...' : 'Download Tiesheets'}
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => { setPreviewCatId(null); setPreviewModalOpen(true); }}
                      >
                        <Eye size={16} style={{ marginRight: '8px' }} />
                        Open Preview
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {((compRules === 'wkf' && activePhase === 4) || (compRules !== 'wkf' && activePhase === 5) || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase {compRules === 'wkf' ? '4' : '5'} — Staff Assignment + Mat Security</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Lock in who runs each mat, attendance coverage, medal distribution, and passwords.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                <div className="cat-group">
                  <div className="flex-between mb-4">
                    <div>
                      <h3>Mat Security</h3>
                      <p className="text-small">Set unique access passwords for each mat score table.</p>
                    </div>
                    <button className="btn btn-ghost">
                      <Key size={16} /> Bulk Set
                    </button>
                  </div>
                  <div className="mat-setup-list">
                    {Array.from({ length: matsCount }).map((_, i) => (
                      <div key={i} className="mat-setup-card">
                        <div className="mat-header">
                          <div className="mat-number-badge">{i + 1}</div>
                          <span className="status-chip" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)' }}>Pending</span>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="text-micro">Scoreboard Access Password</label>
                          <div className="password-input-group">
                            <input
                              type={showPasswordMap[i] ? "text" : "password"}
                              placeholder="Enter mat password"
                              value={matPasswordMap[i] ?? ''}
                              onChange={e => setMatPasswordMap(prev => ({ ...prev, [i]: e.target.value }))}
                              onBlur={() => {
                                if (matPasswordMap[i]?.trim()) saveMatPassword(i, matPasswordMap[i].trim());
                              }}
                            />
                            <div className="toggle-password" onClick={() => togglePassword(i)}>
                              {showPasswordMap[i] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cat-group">
                  <div className="flex-between">
                    <div>
                      <h3>Attendance Volunteers</h3>
                      <p className="text-small">Assign volunteers to manage athlete attendance per category.</p>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="cat-table">
                      <thead>
                        <tr>
                          <th className="text-micro">Category</th>
                          <th className="text-micro">Assigned Volunteer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredCategories, ...specialCategories].map((cat, idx) => (
                          <tr key={cat.id || idx}>
                            <td style={{ fontWeight: 500 }}>{cat.name}</td>
                            <td>
                              <select className="input-field" style={{ height: '36px', marginBottom: 0 }}>
                                <option value="">Unassigned</option>
                                <option value="john">John Doe</option>
                                <option value="jane">Jane Smith</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                        {[...filteredCategories, ...specialCategories].length === 0 && (
                          <tr>
                            <td colSpan={2} style={{ textAlign: 'center', color: 'var(--neutral-500)', padding: 'var(--space-6)' }}>
                              No categories defined.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      <div className={`modal-overlay ${modalType ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3>
              {modalType === 'standard' && 'Add Standard Category'}
              {modalType === 'special' && 'Create Special Category'}
              {modalType === 'merge' && 'Merge Categories'}
            </h3>
            <button className="close-btn" onClick={() => { setModalType(null); setModalFormData({}); }}><X size={16} /></button>
          </div>
          <div className="modal-body">
            {modalType === 'standard' && (
              <>
                <div className="form-group">
                  <label>Category Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Senior Male -75kg" value={modalFormData.name || ''} onChange={e => setModalFormData({...modalFormData, name: e.target.value})} />
                </div>
                {compRules !== 'wkf' && (
                  <>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Discipline</label>
                        <select className="input-field" style={{ background: 'white' }} value={modalFormData.discipline || 'Kumite'} onChange={e => setModalFormData({...modalFormData, discipline: e.target.value})}>
                          <option value="Kumite">Kumite</option>
                          <option value="Kata">Kata</option>
                        </select>
                        {modalFormData.discipline === 'Kata' && (
                          <p style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '4px' }}>Kata categories are not divided by age groups.</p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Gender</label>
                        <select className="input-field" style={{ background: 'white' }} value={modalFormData.gender || ''} onChange={e => setModalFormData({...modalFormData, gender: e.target.value})}>
                          <option value="">Any</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Min Age</label>
                        <input type="number" className="input-field" placeholder="0" value={modalFormData.minAge || ''} onChange={e => setModalFormData({...modalFormData, minAge: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Max Age</label>
                        <input type="number" className="input-field" placeholder="99" value={modalFormData.maxAge || ''} onChange={e => setModalFormData({...modalFormData, maxAge: e.target.value})} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Min Weight (kg)</label>
                        <input type="number" className="input-field" placeholder="0" value={modalFormData.minWeight || ''} onChange={e => setModalFormData({...modalFormData, minWeight: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Max Weight (kg)</label>
                        <input type="number" className="input-field" placeholder="300" value={modalFormData.maxWeight || ''} onChange={e => setModalFormData({...modalFormData, maxWeight: e.target.value})} />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {modalType === 'special' && (
              <>
                <div className="form-group">
                  <label>Special Category Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Super Gold Open" value={modalFormData.name || ''} onChange={e => setModalFormData({...modalFormData, name: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Medal Requirement</label>
                    <select className="input-field" style={{ background: 'white' }} value={modalFormData.medal || ''} onChange={e => setModalFormData({...modalFormData, medal: e.target.value})}>
                      <option value="">Any Medal</option>
                      <option value="Gold Only">Gold Only</option>
                      <option value="Silver or Above">Silver or Above</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Min Age</label>
                    <input type="number" className="input-field" placeholder="0" value={modalFormData.minAge || ''} onChange={e => setModalFormData({...modalFormData, minAge: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Max Age</label>
                    <input type="number" className="input-field" placeholder="99" value={modalFormData.maxAge || ''} onChange={e => setModalFormData({...modalFormData, maxAge: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Min Weight (kg)</label>
                    <input type="number" className="input-field" placeholder="0" value={modalFormData.minWeight || ''} onChange={e => setModalFormData({...modalFormData, minWeight: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Max Weight (kg)</label>
                    <input type="number" className="input-field" placeholder="300" value={modalFormData.maxWeight || ''} onChange={e => setModalFormData({...modalFormData, maxWeight: e.target.value})} />
                  </div>
                </div>
              </>
            )}
            {modalType === 'merge' && (
              <>
                <div className="form-group">
                  <label>New Merged Category Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Cadet Female +61kg merged" value={modalFormData.name || ''} onChange={e => setModalFormData({...modalFormData, name: e.target.value})} />
                </div>
                <p className="text-small" style={{ color: 'var(--neutral-500)' }}>Select categories to merge from the list in WKF mode, or type the name manually here if custom.</p>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setModalType(null); setModalFormData({}); }}>Cancel</button>
            <button className="btn btn-primary" onClick={() => {
              if (modalType === 'standard' && modalFormData.name) {
                const isKata = (modalFormData.discipline || 'Kumite') === 'Kata';
                setCategories([...categories, { 
                  id: modalFormData.name, 
                  name: modalFormData.name, 
                  discipline: modalFormData.discipline || 'Kumite',
                  gender: modalFormData.gender || 'Any',
                  minAge: isKata ? 0 : (parseInt(modalFormData.minAge) || 0),
                  maxAge: isKata ? 999 : (parseInt(modalFormData.maxAge) || 99),
                  minWeight: parseFloat(modalFormData.minWeight) || 0,
                  maxWeight: parseFloat(modalFormData.maxWeight) || 300,
                  entries: 0 
                }]);
              } else if (modalType === 'special' && modalFormData.name) {
                setSpecialCategories([...specialCategories, { 
                  id: modalFormData.name, 
                  name: modalFormData.name, 
                  medal: modalFormData.medal, 
                  minAge: parseInt(modalFormData.minAge) || 0,
                  maxAge: parseInt(modalFormData.maxAge) || 99,
                  minWeight: parseFloat(modalFormData.minWeight) || 0,
                  maxWeight: parseFloat(modalFormData.maxWeight) || 300,
                  entries: 0 
                }]);
              } else if (modalType === 'merge' && modalFormData.name) {
                 if (compRules === 'wkf' && selectedCats.size >= 2) {
                   const totalEntries = categories
                     .filter(c => selectedCats.has(c.id))
                     .reduce((sum, c) => sum + (c.entries || 0), 0);
                   const remaining = categories.filter(c => !selectedCats.has(c.id));
                   remaining.unshift({ id: modalFormData.name, name: modalFormData.name, entries: totalEntries });
                   setCategories(remaining);
                   setSelectedCats(new Set());
                 } else {
                   setCategories([...categories, { id: modalFormData.name, name: modalFormData.name, entries: 0 }]);
                 }
              }
              setModalType(null);
              setModalFormData({});
            }}>Confirm Action</button>
          </div>
        </div>
      </div>

      {/* Fullscreen Tiesheet Preview — reads live from Firestore */}
      {previewModalOpen && (
        <SetupBracketPreview
          competitionId={id}
          initialCategoryId={previewCatId}
          onClose={() => setPreviewModalOpen(false)}
        />
      )}
    </>
  );
}

// ─── SetupBracketPreview ────────────────────────────────────────────────────────
// Loads categories live from Firestore and shows first-round-only brackets
function SetupBracketPreview({ competitionId, initialCategoryId, onClose }: {
  competitionId: string;
  initialCategoryId: string | null;
  onClose: () => void;
}) {
  const [categories, setCategories] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let unsub: (() => void) | undefined;
    const load = async () => {
      const { collection, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('@lib/firebase');
      unsub = onSnapshot(collection(db, 'competitions', competitionId, 'categories'), snap => {
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    };
    load();
    return () => unsub?.();
  }, [competitionId]);

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', fontSize: '16px', fontWeight: 600 }}>Loading brackets…</div>
    </div>
  );

  if (categories.length === 0) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px' }}>
        <p>No categories found. Import an Excel file first.</p>
        <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: '16px' }}>Close</button>
      </div>
    </div>
  );

  return (
    <FullscreenBracketModal
      categories={categories}
      initialCategoryId={initialCategoryId || categories[0]?.id}
      firstRoundOnly={true}
      onClose={onClose}
    />
  );
}

