'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Save, CheckCircle, Combine, Plus, Edit2, Trash2, Star, FileSpreadsheet, RefreshCw, Key, ChevronDown, Eye, EyeOff, UploadCloud, X, Download, Search, GripVertical } from 'lucide-react';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';
import UndersizedPoolsModal from '@/components/UndersizedPoolsModal';
import StaffAssignmentManager from '@/components/StaffAssignmentManager';
import EditCategoryModal from '@/components/EditCategoryModal';
import OnSpotEntryModal from '@/components/OnSpotEntryModal';
import PageSkeleton from '@/components/layout/PageSkeleton';
import { toast } from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function SetupWizard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
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
  const [modalType, setModalType] = useState<'standard'|'merge'|'bulkPassword'|'onspot'|'editCategory'|null>(null);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatData, setEditCatData] = useState<any>(null);
  const [editCatName, setEditCatName] = useState<string>('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [undersizedModalOpen, setUndersizedModalOpen] = useState(false);
  const [previewCatId, setPreviewCatId] = useState<string | null>(null);
  const [downloadingTiesheets, setDownloadingTiesheets] = useState(false);
  const [regeneratingTiesheets, setRegeneratingTiesheets] = useState(false);
  const [modalFormData, setModalFormData] = useState<any>({});
  const [compName, setCompName] = useState<string>('Loading...');
  const [compVenue, setCompVenue] = useState<string>('');
  const [compDate, setCompDate] = useState<string>('');
  const [scoreboardLogo, setScoreboardLogo] = useState<string | null>(null);
  
  const [compRules, setCompRules] = useState<string>('');
  const [compType, setCompType] = useState<string>('international');
  const [bronzeRule, setBronzeRule] = useState<'two' | 'one'>('two');
  const [wkfMode, setWkfMode] = useState<string>('standard');
  const [wkfKataJudgeCount, setWkfKataJudgeCount] = useState<3 | 5 | 7>(3);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const [filterGender, setFilterGender] = useState<'all'|'male'|'female'>('all');
  const [filterDiscipline, setFilterDiscipline] = useState<'all'|'kata'|'kumite'>('all');
  const [hideEmpty, setHideEmpty] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; title: string; message: string; isDestructive: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', isDestructive: false, onConfirm: () => {} });

  const closeConfirm = () => setConfirmState(prev => ({ ...prev, isOpen: false }));

  const saveDraft = async (targetPhase: number) => {
    setIsSaving(true);
    try {
      // Clean undefined values for Zod and API
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

      const payload = stripUndefined({
        competitionId: id,
        compName: compName || 'Untitled',
        matsCount,
        poolSize,
        compRules: compRules || 'custom',
        compType,
        bronzeRule,
        wkfMode,
        wkfKataJudgeCount,
        categories,
        importResult: importResult ?? undefined,
        scoreboardLogo: scoreboardLogo ?? undefined,
        lastActivePhase: targetPhase,
        highestPhase: Math.max(highestPhase, targetPhase)
      });

      const res = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveSetupDraft', payload })
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('API Gateway Error:', err);
      } else {
        setLastSaved(new Date());
      }
    } catch (err) {
      console.error('Error saving draft via API Gateway:', err);
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
  }, [
    compName, matsCount, poolSize, compRules, compType, 
    bronzeRule, wkfMode, wkfKataJudgeCount, categories, 
    importResult, scoreboardLogo, activePhase, highestPhase, isDataLoaded
  ]);

  const handleWkfModeChange = async (mode: string) => {
    setWkfMode(mode);
    const { generateWkfCategories } = await import('@taikaix/backend/lib/wkf-categories');
    setCategories(generateWkfCategories(mode).map(name => {
      const isKata = name.toLowerCase().includes('kata');
      return { id: name, name, entries: 0, isKata, judgeCount: isKata ? wkfKataJudgeCount : undefined };
    }));
  };

  useEffect(() => {
    const fetchComp = async () => {
      try {
        const [{ getDoc, doc }, { db }] = await Promise.all([
          import('firebase/firestore'),
          import('@lib/firebase')
        ]);
        
        // Load main doc for Name, Venue, Date
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists()) {
          const mainData = snap.data();
          setCompName(mainData.name || 'Untitled Tournament');
          if (mainData.venue) setCompVenue(mainData.venue);
          if (mainData.scoreboardLogo) setScoreboardLogo(mainData.scoreboardLogo);
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
          if (draftData.bronzeRule !== undefined) setBronzeRule(draftData.bronzeRule);
          if (draftData.wkfMode !== undefined) setWkfMode(draftData.wkfMode);
          if (draftData.wkfKataJudgeCount !== undefined) setWkfKataJudgeCount(draftData.wkfKataJudgeCount);
          if (draftData.categories !== undefined) setCategories(draftData.categories);
          if (draftData.importResult !== undefined) setImportResult(draftData.importResult);
          if (draftData.scoreboardLogo !== undefined) setScoreboardLogo(draftData.scoreboardLogo);
          if (draftData.highestPhase !== undefined) setHighestPhase(draftData.highestPhase);
          else if (draftData.lastActivePhase !== undefined) setHighestPhase(draftData.lastActivePhase);
          if (draftData.lastActivePhase !== undefined) setActivePhase(draftData.lastActivePhase);
          
          // WKF draft with no saved categories: generate preset list
          const effectiveRules = draftData.compRules ?? (snap.exists() ? snap.data()?.rules : undefined);
          const hasCategories = Array.isArray(draftData.categories) && draftData.categories.length > 0;
          if (effectiveRules === 'wkf' && !hasCategories) {
            const { generateWkfCategories } = await import('@taikaix/backend/lib/wkf-categories');
            const effectiveMode = draftData.wkfMode ?? 'standard';
            const effectiveJudgeCount: 3 | 5 | 7 = (draftData.wkfKataJudgeCount ?? 3) as 3 | 5 | 7;
            setCategories(generateWkfCategories(effectiveMode).map(name => {
              const isKata = name.toLowerCase().includes('kata');
              return { id: name, name, entries: 0, isKata, judgeCount: isKata ? effectiveJudgeCount : undefined };
            }));
          }

          setIsDataLoaded(true);
          return;
        }

        if (snap.exists()) {
          const data = snap.data();
          setCompRules(data.rules);
          setCompType(data.type || 'international');
          if (data.bronzeRule) setBronzeRule(data.bronzeRule);
          if (data.mats !== undefined) setMatsCount(data.mats);
          
          if (data.rules === 'wkf') {
            const { generateWkfCategories } = await import('@taikaix/backend/lib/wkf-categories');
            const { collection, getDocs } = await import('firebase/firestore');
            const catSnap = await getDocs(collection(db, 'competitions', id, 'categories'));
            
            const existingEntries = new Map<string, number>();
            catSnap.docs.forEach(doc => {
              existingEntries.set(doc.data().name, doc.data().entries || 0);
            });
            
            setCategories(generateWkfCategories(wkfMode).map(name => {
              const isKata = name.toLowerCase().includes('kata');
              return { 
                id: name, 
                name, 
                entries: existingEntries.get(name) || 0,
                isKata,
                judgeCount: isKata ? wkfKataJudgeCount : undefined
              };
            }));
          } else {
            const { collection, getDocs } = await import('firebase/firestore');
            const catSnap = await getDocs(collection(db, 'competitions', id, 'categories'));
            setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  useEffect(() => {
    if (!isDataLoaded) return;
    const loadPasswords = async () => {
      try {
        const [{ doc, getDoc }, { db }] = await Promise.all([
          import('firebase/firestore'),
          import('@lib/firebase')
        ]);
        const loaded: Record<number, string> = {};
        await Promise.all(
          Array.from({ length: matsCount }).map(async (_, i) => {
            const matId = `mat-${i + 1}`;
            const snap = await getDoc(doc(db, 'competitions', id, 'mats', matId));
            if (snap.exists() && snap.data().password) {
              loaded[i] = snap.data().password;
            }
          })
        );
        // Merge with existing passwords in case user typed something while it was loading
        setMatPasswordMap(prev => ({ ...prev, ...loaded }));
      } catch (err) {
        console.error("Failed to load individual mat passwords", err);
      }
    };
    loadPasswords();
  }, [isDataLoaded, matsCount, id]);

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
      const [{ db }, { doc, setDoc }] = await Promise.all([
        import('@lib/firebase'),
        import('firebase/firestore')
      ]);
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

  const bulkSetMatPasswords = () => {
    setModalFormData({ password: '' });
    setModalType('bulkPassword');
  };

  const handleExportPreset = () => {
    if (categories.length === 0) {
      toast.error('No categories to export');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(categories, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${compRules}_preset.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const newCats = imported.map(cat => ({
            ...cat,
            id: Math.random().toString(36).substring(2, 9),
            entries: 0,
            athletes: []
          }));
          setCategories(prev => [...prev, ...newCats]);
          toast.success(`Imported ${newCats.length} categories`);
        } else {
          toast.error('Invalid preset format');
        }
      } catch (err) {
        toast.error('Failed to parse preset file');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleLoadWkfCategories = async () => {
    try {
      const { generateWkfCategories } = await import('@taikaix/backend/lib/wkf-categories');
      const wkfCats = generateWkfCategories('standard');
      const newCats = wkfCats.map(name => {
        const isKata = name.toLowerCase().includes('kata');
        let gender = 'Any';
        if (name.includes('Male') && !name.includes('Female')) gender = 'Male';
        if (name.includes('Female') && !name.includes('Male')) gender = 'Female';
        let discipline = isKata ? 'Kata' : 'Kumite';
        return {
          id: Math.random().toString(36).substring(2, 9),
          name,
          entries: 0,
          athletes: [],
          isKata,
          gender,
          discipline,
          judgeCount: isKata ? 3 : undefined
        };
      });
      setCategories(prev => {
        const existingNames = new Set(prev.map(c => c.name));
        const filteredNewCats = newCats.filter(c => !existingNames.has(c.name));
        return [...prev, ...filteredNewCats];
      });
      toast.success(`Loaded WKF Categories`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load WKF categories');
    }
  };

  const maxPhase = 6;

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setScoreboardLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('compRules', compRules);
      formData.append('compType', compType);
      formData.append('bronzeRule', bronzeRule);
      formData.append('poolSize', poolSize.toString());
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    // Reset the input value so the same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDownloadTiesheets = async () => {
    if (downloadingTiesheets) return;
    setDownloadingTiesheets(true);
    try {
      const [{ db }, { collection, getDocs }] = await Promise.all([
        import('@lib/firebase'),
        import('firebase/firestore')
      ]);
      const snap = await getDocs(collection(db, 'competitions', id, 'categories'));
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      if (cats.length === 0) {
        toast.error('No categories found. Import athletes first.');
        return;
      }
      const { exportTiesheetsPDF } = await import('@taikaix/backend/services/tiesheet-pdf-exporter');
      await exportTiesheetsPDF({
        competitionName: compName,
        categories: cats.map((c: any) => ({
          name: c.name,
          matches: c.matches ?? [],
          athletes: c.athletes ?? [],
          matNo: c.mat || '',
          isKata: c.isKata === true || (typeof c.name === 'string' && c.name.toLowerCase().includes('kata')),
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

  const handleRegenerateTiesheets = async () => {
    if (regeneratingTiesheets) return;
    setRegeneratingTiesheets(true);
    const toastId = toast.loading('Regenerating tiesheets...');
    try {
      const [{ db }, { collection, getDocs }] = await Promise.all([
        import('@lib/firebase'),
        import('firebase/firestore')
      ]);
      const snap = await getDocs(collection(db, 'competitions', id, 'categories'));
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const standardCats = cats.filter(c => !c.isSpecial && (c.athletes?.length ?? 0) > 0);
      if (standardCats.length === 0) {
        toast.dismiss(toastId);
        toast.error('No categories with athletes found. Import athletes first.');
        return;
      }
      let ok = 0; let fail = 0;
      await Promise.all(standardCats.map(async (cat) => {
        try {
          const res = await fetch(`/api/competitions/${id}/brackets/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: cat.id, poolSize, compType }),
          });
          const json = await res.json();
          if (json.success) ok++; else fail++;
        } catch { fail++; }
      }));
      toast.dismiss(toastId);
      if (fail === 0) {
        toast.success(`Tiesheets regenerated for ${ok} categories!`);
      } else {
        toast.success(`Regenerated ${ok} categories. ${fail} skipped (no athletes).`);
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error('Failed to regenerate: ' + e.message);
    } finally {
      setRegeneratingTiesheets(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const payload = {
        competitionId: id,
        compName,
        matsCount,
        poolSize,
        compRules,
        compType,
        bronzeRule,
        wkfMode,
        wkfKataJudgeCount,
        categories,
        hideEmpty,
        scoreboardLogo: scoreboardLogo ?? undefined
      };

      const res = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deployTournament', payload })
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('API Gateway Error:', err);
        throw new Error('Deployment failed');
      }

      toast.success("Deployment successful! Schedule generated and saved.");
      window.location.href = `/competitions/${id}`;
    } catch (err) {
      console.error(err);
      toast.error("Failed to deploy tournament.");
    } finally {
      setDeploying(false);
    }
  };

  // Note: handleFinalize no longer needed — categories are saved by the API on import

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleRowDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); return; }

    setCategories(prev => {
      const newCats = [...prev];
      const originalDragIdx = newCats.findIndex(c => c.id === filteredCategories[dragIdx].id);
      const originalDropIdx = newCats.findIndex(c => c.id === filteredCategories[dropIdx].id);
      
      if (originalDragIdx !== -1 && originalDropIdx !== -1) {
        const [removed] = newCats.splice(originalDragIdx, 1);
        newCats.splice(originalDropIdx, 0, removed);
      }
      return newCats;
    });
    setDragIdx(null);
  };

  const filteredCategories = categories.filter(c => {
    if (hideEmpty && (!c.entries || c.entries === 0)) return false;
    const lowerName = c.name.toLowerCase();
    if (searchQuery && !lowerName.includes(searchQuery.toLowerCase())) return false;
    if (filterGender === 'female' && !lowerName.includes('female')) return false;
    if (filterGender === 'male' && (!lowerName.includes('male') || lowerName.includes('female'))) return false;
    const isKata = lowerName.endsWith('kata') || lowerName.includes(' kata ');
    if (filterDiscipline === 'kata' && !isKata) return false;
    if (filterDiscipline === 'kumite' && isKata) return false;
    return true;
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .setup-grid { display: flex; flex-direction: column; gap: var(--space-5); }
        .wizard-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); flex-wrap: wrap; }
        .wizard-stepper { display: grid; grid-template-columns: repeat(var(--stepper-cols, 5), minmax(0, 1fr)); gap: var(--space-3); }
        .wizard-step { border: 1px solid var(--neutral-300); background: var(--shiro); padding: 12px 14px; border-radius: 10px; text-align: left; cursor: pointer; transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out), background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out); user-select: none; }
        .wizard-step:hover:not(:disabled) { border-color: var(--neutral-400); }
        .wizard-step:active:not(:disabled) { transform: scale(0.98); }
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
        .dropzone { border: 2px dashed var(--neutral-300); border-radius: 12px; padding: var(--space-8); text-align: center; background: var(--neutral-50); transition: all 160ms var(--ease-out); cursor: pointer; }
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
        .input-field { width: 100%; height: 44px; padding: 0 12px; border: 1.5px solid var(--neutral-300); border-radius: 8px; font-family: inherit; font-size: 14px; outline: none; transition: border-color 160ms var(--ease-out); background: var(--shiro); }
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
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            {lastSaved && (
              <span className="text-micro" style={{ color: 'var(--neutral-500)' }}>
                {isSaving ? 'Saving...' : `Last saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => saveDraft(activePhase)} disabled={isSaving}>
              <Save size={16} /> Save Draft
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDeploy} disabled={!importResult}>
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
              <button type="button" className="btn btn-ghost" onClick={() => { setIsReviewMode(true); setActivePhase(maxPhase); }}>
                Skip to Review <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </button>
            </div>
          </div>

          <div className="wizard-stepper">
            <div className={`step ${activePhase === 1 ? 'active' : ''} ${activePhase > 1 ? 'completed' : ''}`} onClick={() => setPhase(1)} style={{ cursor: 1 <= highestPhase ? 'pointer' : 'default' }}>
              <div className="step-circle">1</div>
              <div className="step-label">Define Categories</div>
            </div>
            <div className={`step ${activePhase === 2 ? 'active' : ''} ${activePhase > 2 ? 'completed' : ''}`} onClick={() => setPhase(2)} style={{ cursor: 2 <= highestPhase ? 'pointer' : 'default' }}>
              <div className="step-circle">2</div>
              <div className="step-label">Roster/CSV Import</div>
            </div>
            <div className={`step ${activePhase === 3 ? 'active' : ''} ${activePhase > 3 ? 'completed' : ''}`} onClick={() => setPhase(3)} style={{ cursor: 3 <= highestPhase ? 'pointer' : 'default' }}>
              <div className="step-circle">3</div>
              <div className="step-label">Category, Mat & Schedule Management</div>
            </div>
            <div className={`step ${activePhase === 4 ? 'active' : ''} ${activePhase > 4 ? 'completed' : ''}`} onClick={() => setPhase(4)} style={{ cursor: 4 <= highestPhase ? 'pointer' : 'default' }}>
              <div className="step-circle">4</div>
              <div className="step-label">Tiesheet Preview</div>
            </div>
            <div className={`step ${activePhase === 5 ? 'active' : ''} ${activePhase > 5 ? 'completed' : ''}`} onClick={() => setPhase(5)} style={{ cursor: 5 <= highestPhase ? 'pointer' : 'default' }}>
              <div className="step-circle">5</div>
              <div className="step-label">Staff Management</div>
            </div>
            <div className={`step ${activePhase === 6 ? 'active' : ''} ${activePhase > 6 ? 'completed' : ''}`} onClick={() => setPhase(6)} style={{ cursor: 6 <= highestPhase ? 'pointer' : 'default' }}>
              <div className="step-circle">6</div>
              <div className="step-label">Review</div>
            </div>
          </div>

          <div className="wizard-actions">
            <div className="text-small">Step {activePhase} of {maxPhase}</div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-ghost" disabled={activePhase === 1} onClick={handleBack}>Back</button>
              <button type="button" className="btn btn-primary" disabled={activePhase === maxPhase} onClick={handleNext}>Next</button>
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
                  <button type="button" className="btn btn-ghost" onClick={() => setPhase(4)}>Return to Step 4</button>
                  <button type="button" className="btn btn-primary" disabled={deploying} onClick={handleDeploy}>
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
                  <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Bronze Medal Rules</label>
                    <select 
                      className="input-field" 
                      value={bronzeRule} 
                      onChange={e => setBronzeRule(e.target.value as 'two' | 'one')} 
                      style={{ marginBottom: 0 }}
                    >
                      <option value="two">2 Bronze Medals (Awarded to both Semi-final losers)</option>
                      <option value="one">1 Bronze Medal (Requires a 3rd-place playoff match)</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {(activePhase === 2 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 2 — Roster/CSV Import</h3>
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
                      
                      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--neutral-200)' }}>
                        <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: '13px' }}>Kata Judge Count</h4>
                        <p className="text-small" style={{ marginBottom: 'var(--space-3)', color: 'var(--neutral-600)' }}>Applies to all generated Kata categories.</p>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                          {[3, 5, 7].map(count => (
                            <label key={count} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input type="radio" name="wkfKataJudgeCount" value={count} checked={wkfKataJudgeCount === count} onChange={() => {
                                setWkfKataJudgeCount(count as 3|5|7);
                                setCategories(prev => prev.map(c => 
                                  c.name.toLowerCase().includes('kata') ? { ...c, judgeCount: count } : c
                                ));
                              }} />
                              <span className="text-small">{count} Judges</span>
                            </label>
                          ))}
                        </div>
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

                  <div 
                    className="dropzone" 
                    onClick={() => document.getElementById('excel-upload')?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                  >
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
                    <button type="button" className="btn btn-primary" disabled={uploading}>
                      {uploading ? 'Processing...' : importResult ? 'Upload Another File' : 'Browse Files'}
                    </button>
                    <input type="file" id="excel-upload" style={{ display: 'none' }} accept=".csv, .xls, .xlsx" onChange={handleFileUpload} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {((is5Phase && activePhase === 2) || (!is5Phase && activePhase === 1) || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>{is5Phase ? 'Phase 2 — Category, Mat & Schedule Management' : 'Phase 1 — Define Categories'}</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Define divisions for the tournament.</p>
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

                  <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px dashed var(--neutral-300)' }}>
                    <div className="flex-between mb-4">
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px' }}>Scoreboard Logo (Optional)</h4>
                        <p className="text-small" style={{ marginTop: '4px' }}>Upload a 1:1 ratio logo to display on all live scoreboards.</p>
                      </div>
                      {scoreboardLogo && (
                        <button type="button" className="btn btn-ghost" onClick={() => setScoreboardLogo(null)} style={{ color: 'var(--aka)' }}>
                          <Trash2 size={14} style={{ marginRight: '6px' }}/> Remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      {scoreboardLogo && (
                        <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#fff', border: '1px solid var(--neutral-200)', flexShrink: 0 }}>
                          <img src={scoreboardLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload}
                        className="input-field" 
                        style={{ flex: 1, padding: '8px', height: 'auto', background: '#fff' }}
                      />
                    </div>
                  </div>
                  <div className="flex-between mb-4" style={{ marginTop: 'var(--space-4)' }}>
                    <div>
                      <h3>Mat Security</h3>
                      <p className="text-small">Set unique access passwords for each mat score table.</p>
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={bulkSetMatPasswords}>
                      <Key size={16} /> Bulk Set
                    </button>
                  </div>
                  <div className="mat-setup-list">
                    {Array.from({ length: Number(matsCount) || 1 }).map((_, i) => (
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
                  <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ minWidth: '200px' }}>
                      <h3>{compRules === 'wkf' ? 'Standard Categories' : 'Categories'}</h3>
                      <p className="text-small">{compRules === 'wkf' ? 'Generic weight and age divisions without complex prerequisite rules.' : 'Divisions for the tournament.'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-ghost" style={{ color: 'var(--status-live)', border: '1px dashed var(--status-live)', height: '36px', padding: '0 12px' }} onClick={() => setModalType('onspot')}>
                        <Plus size={16} /> On-Spot Entry
                      </button>
                      {compRules === 'wkf' ? (
                        <button type="button" className="btn btn-secondary" style={{ height: '36px', padding: '0 12px' }} onClick={handleMerge} disabled={selectedCats.size < 2}>
                          <Combine size={16} /> Merge Selected
                        </button>
                      ) : (
                        <>
                          <button type="button" className="btn btn-ghost" style={{ height: '36px', padding: '0 12px' }} onClick={handleExportPreset}>
                            <Download size={16} /> Export
                          </button>
                          <button type="button" className="btn btn-ghost" style={{ height: '36px', padding: '0 12px' }} onClick={() => document.getElementById('preset-upload')?.click()}>
                            <UploadCloud size={16} /> Import
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={handleLoadWkfCategories} style={{ color: 'var(--ao)', borderColor: 'var(--ao)', height: '36px', padding: '0 12px' }}>
                            <RefreshCw size={16} /> Load WKF Rules
                          </button>
                          <input type="file" id="preset-upload" style={{ display: 'none' }} accept=".json" onChange={handleImportPreset} />
                          <button type="button" className="btn btn-ghost" style={{ height: '36px', padding: '0 12px' }} onClick={() => setModalType('merge')}>
                            <Combine size={16} /> Merge
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ height: '36px', padding: '0 12px' }} onClick={() => setModalType('standard')}>
                            <Plus size={16} /> Add Category
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'var(--shiro)', border: '1px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', height: '36px', flex: 1, minWidth: '200px' }}>
                      <Search size={16} style={{ color: 'var(--neutral-500)', marginRight: '8px' }} />
                      <input 
                        type="text" 
                        placeholder="Search categories..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '14px' }}
                      />
                    </div>
                    <select className="input-field" style={{ width: '160px', height: '36px', marginBottom: 0 }} value={filterGender} onChange={e => setFilterGender(e.target.value as any)}>
                      <option value="all">All Genders</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <select className="input-field" style={{ width: '160px', height: '36px', marginBottom: 0 }} value={filterDiscipline} onChange={e => setFilterDiscipline(e.target.value as any)}>
                      <option value="all">All Disciplines</option>
                      <option value="kata">Kata Only</option>
                      <option value="kumite">Kumite Only</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--neutral-700)', marginLeft: '4px' }}>
                      <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
                      Hide 0 Entries
                    </label>
                  </div>

                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="cat-table">
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--shiro)', zIndex: 10 }}>
                        <tr>
                          <th style={{ width: '32px' }}></th>
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
                          <tr 
                            key={cat.id || idx}
                            draggable
                            onDragStart={e => handleDragStart(e, idx)}
                            onDragOver={e => handleRowDragOver(e, idx)}
                            onDrop={e => handleRowDrop(e, idx)}
                            style={{ 
                              opacity: dragIdx === idx ? 0.5 : 1,
                              borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx > idx ? '2px solid var(--ao)' : 'none',
                              borderBottom: dragOverIdx === idx && dragIdx !== null && dragIdx < idx ? '2px solid var(--ao)' : 'none',
                              cursor: 'move'
                            }}
                          >
                            <td style={{ color: 'var(--neutral-400)', cursor: 'grab' }}><GripVertical size={16} /></td>
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
                              {(cat.isKata || cat.name.toLowerCase().includes('kata')) && (
                                <div style={{ marginTop: '6px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, marginRight: '8px' }}>Judges:</span>
                                  {[3, 5, 7].map(count => (
                                    <label key={count} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginRight: '8px', fontSize: '11px' }}>
                                      <input 
                                        type="radio" 
                                        name={`judgeCount-${cat.id || idx}`} 
                                        value={count} 
                                        checked={(cat.judgeCount || wkfKataJudgeCount || 3) === count} 
                                        onChange={() => {
                                          setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, judgeCount: count } : c));
                                        }} 
                                      />
                                      {count}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>{cat.entries}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => {
                                setEditCatId(cat.id);
                                setEditCatName(cat.name);
                                setEditCatData({ ...cat });
                                setModalType('editCategory');
                              }}><Edit2 size={16} /></button>
                              <button type="button" className="btn btn-ghost" style={{ padding: '4px', color: 'var(--aka)' }} onClick={() => setCategories(categories.filter(c => c.id !== cat.id))}><Trash2 size={16} /></button>
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

          {(activePhase === 3 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 3 — Category, Mat & Schedule Management</h3>
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

                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px dashed var(--neutral-300)' }}>
                      <div className="flex-between mb-4">
                        <div>
                          <h4 style={{ margin: 0, fontSize: '14px' }}>Scoreboard Logo (Optional)</h4>
                          <p className="text-small" style={{ marginTop: '4px' }}>Upload a 1:1 ratio logo to display on all live scoreboards.</p>
                        </div>
                        {scoreboardLogo && (
                          <button type="button" className="btn btn-ghost" onClick={() => setScoreboardLogo(null)} style={{ color: 'var(--aka)' }}>
                            <Trash2 size={14} style={{ marginRight: '6px' }}/> Remove
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        {scoreboardLogo && (
                          <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#fff', border: '1px solid var(--neutral-200)', flexShrink: 0 }}>
                            <img src={scoreboardLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleLogoUpload}
                          className="input-field" 
                          style={{ flex: 1, padding: '8px', height: 'auto', background: '#fff' }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-between mb-4" style={{ marginTop: 'var(--space-4)' }}>
                    <div>
                      <h3>Mat Security</h3>
                      <p className="text-small">Set unique access passwords for each mat score table.</p>
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={bulkSetMatPasswords}>
                      <Key size={16} /> Bulk Set
                    </button>
                  </div>
                  <div className="mat-setup-list">
                    {Array.from({ length: Number(matsCount) || 1 }).map((_, i) => (
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
            </section>
          )}

          {(activePhase === 4 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 4 — Tiesheet Generation Preview</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Tiesheets are generated on import. Preview verifies first-round matchups.</p>
                  </div>
                </div>
              )}
              <div className="cat-group">
                <p className="text-small">Pool size: {poolSize} (configured in Phase 2)</p>
                {!importResult && categories.length === 0 ? (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px dashed var(--neutral-300)' }}>
                    <p style={{ color: 'var(--neutral-500)' }}>No categories defined yet. Please upload an Excel file in Phase 1 or create categories manually.</p>
                  </div>
                ) : (
                  <div className="mat-setup-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: 'var(--space-4)' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <h4 style={{ margin: '0 0 4px 0' }}>{importResult ? importResult.categoriesTotal : categories.length} Categories Generated</h4>
                      <p className="text-small" style={{ color: 'var(--neutral-500)', margin: 0 }}>
                        {importResult ? importResult.athletesImported : 'N/A'} Athletes {importResult ? 'Imported' : ''} • Pool size: {poolSize}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button"
                          className="btn btn-secondary"
                          onClick={() => setUndersizedModalOpen(true)}
                          disabled={!importResult && categories.length === 0}
                        >
                          <Combine size={16} style={{ marginRight: '6px' }} />
                          Manage Undersized Pools
                        </button>
                        <button type="button"
                          className="btn btn-secondary"
                          style={{ color: 'var(--aka)', borderColor: 'var(--aka)' }}
                          onClick={handleRegenerateTiesheets}
                          disabled={regeneratingTiesheets || (!importResult && categories.length === 0)}
                          title="Re-run bracket generation for all categories. Use this if tiesheets didn't load correctly."
                        >
                          <RefreshCw size={16} style={{ marginRight: '6px' }} />
                          {regeneratingTiesheets ? 'Regenerating...' : 'Regenerate Tiesheets'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button"
                          className="btn btn-primary"
                          onClick={() => { setPreviewCatId(null); setPreviewModalOpen(true); }}
                        >
                          <Eye size={16} style={{ marginRight: '8px' }} />
                          Preview Tiesheets
                        </button>
                        <button type="button"
                          className="btn btn-secondary"
                          onClick={handleDownloadTiesheets}
                          disabled={downloadingTiesheets || (!importResult && categories.length === 0)}
                        >
                          <Download size={16} style={{ marginRight: '6px' }} />
                          {downloadingTiesheets ? 'Generating...' : 'Download Tiesheets'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {(activePhase === 5 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 5 — Staff Management</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Lock in attendance coverage.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                <div className="cat-group">
                  <StaffAssignmentManager competitionId={id} isSetupMode={true} />
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      <div className={`modal-overlay ${(modalType && modalType !== 'editCategory') ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3>
              {modalType === 'standard' && 'Add Category'}
              {modalType === 'merge' && 'Merge Categories'}
              {modalType === 'bulkPassword' && 'Bulk Set Mat Passwords'}
              {modalType === 'onspot' && 'On-Spot Entry'}
            </h3>
            <button type="button" className="close-btn" onClick={() => { setModalType(null); setModalFormData({}); }}><X size={16} /></button>
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
                          <p style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '4px' }}>Kata categories do not use weight classes.</p>
                        )}
                      </div>
                      {modalFormData.discipline === 'Kata' && (
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>Number of Judges</label>
                          <select className="input-field" style={{ background: 'white' }} value={modalFormData.judgeCount || '3'} onChange={e => setModalFormData({...modalFormData, judgeCount: e.target.value})}>
                            <option value="3">3 Judges</option>
                            <option value="5">5 Judges</option>
                            <option value="7">7 Judges</option>
                          </select>
                        </div>
                      )}
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
                    {modalFormData.discipline !== 'Kata' && (
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
                    )}
                  </>
                )}
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

            {modalType === 'bulkPassword' && (
              <>
                <div className="form-group">
                  <label>Generic Password</label>
                  <input type="password" className="input-field" placeholder="Enter password for all mats" value={modalFormData.password || ''} onChange={e => setModalFormData({...modalFormData, password: e.target.value})} />
                </div>
                <p className="text-small" style={{ color: 'var(--neutral-500)' }}>This will overwrite the password for all {matsCount} mats.</p>
              </>
            )}


          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setModalFormData({}); }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={async () => {
              if (modalType === 'standard' && modalFormData.name) {
                const isKata = (modalFormData.discipline || 'Kumite') === 'Kata';
                setCategories([...categories, { 
                  id: modalFormData.name, 
                  name: modalFormData.name, 
                  discipline: modalFormData.discipline || 'Kumite',
                  gender: modalFormData.gender || 'Any',
                  minAge: parseInt(modalFormData.minAge) || 0,
                  maxAge: parseInt(modalFormData.maxAge) || 99,
                  minWeight: isKata ? 0 : (parseFloat(modalFormData.minWeight) || 0),
                  maxWeight: isKata ? 300 : (parseFloat(modalFormData.maxWeight) || 300),
                  isKata: isKata,
                  judgeCount: isKata ? (parseInt(modalFormData.judgeCount) || 3) : undefined,
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
              } else if (modalType === 'bulkPassword' && modalFormData.password) {
                const pwd = modalFormData.password.trim();
                const newMap = { ...matPasswordMap };
                for (let i = 0; i < matsCount; i++) {
                  newMap[i] = pwd;
                }
                setMatPasswordMap(newMap);
                
                try {
                  const [{ db }, { doc, writeBatch }] = await Promise.all([
                    import('@lib/firebase'),
                    import('firebase/firestore')
                  ]);
                  const batch = writeBatch(db);
                  for (let i = 0; i < matsCount; i++) {
                    const matId = `mat-${i + 1}`;
                    batch.set(doc(db, 'competitions', id, 'mats', matId), { password: pwd }, { merge: true });
                  }
                  await batch.commit();
                  toast.success('Bulk set passwords successfully!');
                } catch (err) {
                  console.error(err);
                  toast.error('Failed to bulk set passwords.');
                }

              }
              setModalType(null);
              setModalFormData({});
            }}>Confirm Action</button>
          </div>
        </div>
      </div>

      {modalType === 'editCategory' && editCatId && editCatData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ margin: 0 }}>Edit Category</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => { setModalType(null); setEditCatId(null); setEditCatData(null); }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Name */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="text-micro" style={{ display: 'block', marginBottom: '6px' }}>Category Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={editCatData.name || ''}
                  onChange={e => setEditCatData((p: any) => ({ ...p, name: e.target.value }))}
                  style={{ marginBottom: 0 }}
                />
              </div>

              {compRules !== 'wkf' && (
                <>
                  {/* Discipline */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="text-micro" style={{ display: 'block', marginBottom: '6px' }}>Discipline</label>
                    <select
                      className="input-field"
                      value={editCatData.discipline || 'Kumite'}
                      onChange={e => setEditCatData((p: any) => ({ ...p, discipline: e.target.value, isKata: e.target.value === 'Kata' }))}
                      style={{ marginBottom: 0 }}
                    >
                      <option value="Kumite">Kumite</option>
                      <option value="Kata">Kata</option>
                    </select>
                  </div>

                  {/* Gender */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="text-micro" style={{ display: 'block', marginBottom: '6px' }}>Gender</label>
                    <select
                      className="input-field"
                      value={editCatData.gender || 'Any'}
                      onChange={e => setEditCatData((p: any) => ({ ...p, gender: e.target.value }))}
                      style={{ marginBottom: 0 }}
                    >
                      <option value="Any">Any</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {/* Age Range */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="text-micro" style={{ display: 'block', marginBottom: '6px' }}>Age Range</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--neutral-500)', display: 'block', marginBottom: '4px' }}>Min Age</label>
                        <input
                          type="number"
                          className="input-field"
                          min={0}
                          max={99}
                          value={editCatData.minAge ?? 0}
                          onChange={e => setEditCatData((p: any) => ({ ...p, minAge: parseInt(e.target.value) || 0 }))}
                          style={{ marginBottom: 0 }}
                        />
                      </div>
                      <span style={{ color: 'var(--neutral-400)', marginTop: '16px' }}>—</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--neutral-500)', display: 'block', marginBottom: '4px' }}>Max Age</label>
                        <input
                          type="number"
                          className="input-field"
                          min={0}
                          max={99}
                          value={editCatData.maxAge ?? 99}
                          onChange={e => setEditCatData((p: any) => ({ ...p, maxAge: parseInt(e.target.value) || 99 }))}
                          style={{ marginBottom: 0 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Weight Range — only for Kumite */}
                  {(editCatData.discipline !== 'Kata' && !(editCatData.isKata)) && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="text-micro" style={{ display: 'block', marginBottom: '6px' }}>Weight Range (kg)</label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: 'var(--neutral-500)', display: 'block', marginBottom: '4px' }}>Min Weight</label>
                          <input
                            type="number"
                            className="input-field"
                            min={0}
                            value={editCatData.minWeight ?? 0}
                            onChange={e => setEditCatData((p: any) => ({ ...p, minWeight: parseFloat(e.target.value) || 0 }))}
                            style={{ marginBottom: 0 }}
                          />
                        </div>
                        <span style={{ color: 'var(--neutral-400)', marginTop: '16px' }}>—</span>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: 'var(--neutral-500)', display: 'block', marginBottom: '4px' }}>Max Weight</label>
                          <input
                            type="number"
                            className="input-field"
                            min={0}
                            value={editCatData.maxWeight ?? 300}
                            onChange={e => setEditCatData((p: any) => ({ ...p, maxWeight: parseFloat(e.target.value) || 300 }))}
                            style={{ marginBottom: 0 }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Judge Count — only for Kata */}
              {(editCatData.discipline === 'Kata' || editCatData.isKata) && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="text-micro" style={{ display: 'block', marginBottom: '6px' }}>Kata Judge Count</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[3, 5, 7].map(count => (
                      <label key={count} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', border: `1.5px solid ${editCatData.judgeCount === count ? 'var(--primary)' : 'var(--neutral-200)'}`, borderRadius: '8px', fontWeight: 600, fontSize: '14px', background: editCatData.judgeCount === count ? 'var(--primary-light, #eff6ff)' : 'transparent' }}>
                        <input
                          type="radio"
                          name="edit-judgeCount"
                          value={count}
                          checked={(editCatData.judgeCount || 3) === count}
                          onChange={() => setEditCatData((p: any) => ({ ...p, judgeCount: count }))}
                          style={{ display: 'none' }}
                        />
                        {count} Judges
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--neutral-100)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setEditCatId(null); setEditCatData(null); }}>Cancel</button>
              <button type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!editCatData.name?.trim()) { toast.error('Category name cannot be empty.'); return; }
                  setCategories(prev => prev.map(c => c.id === editCatId ? { ...c, ...editCatData, name: editCatData.name.trim() } : c));
                  setModalType(null);
                  setEditCatId(null);
                  setEditCatData(null);
                  toast.success('Category updated.');
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === 'onspot' && (
        <OnSpotEntryModal
          competitionId={id}
          categories={categories}
          onClose={() => setModalType(null)}
          onSuccess={(catId) => {
             setCategories(prev => prev.map(c => c.id === catId ? { ...c, entries: (c.entries || 0) + 1 } : c));
          }}
        />
      )}

      {previewModalOpen && (
        <SetupBracketPreview
          competitionId={id}
          initialCategoryId={previewCatId || null}
          onClose={() => setPreviewModalOpen(false)}
        />
      )}

      {undersizedModalOpen && (
        <UndersizedPoolsModal
          isOpen={undersizedModalOpen}
          onClose={() => setUndersizedModalOpen(false)}
          compId={id}
          poolSize={poolSize}
          categories={categories}
          onCategoriesUpdated={(newCats) => setCategories(newCats)}
        />
      )}
    </>
  );
}

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
      const [{ collection, onSnapshot }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('@lib/firebase')
      ]);
      unsub = onSnapshot(collection(db, 'competitions', competitionId, 'categories'), snap => {
        const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((c: any) => c.entries > 0);
        setCategories(filtered);
        setLoading(false);
      });
    };
    load();
    return () => unsub?.();
  }, [competitionId]);

  if (loading) return <PageSkeleton />;

  if (categories.length === 0) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px' }}>
        <p>No categories found. Import an Excel file first.</p>
        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ marginTop: '16px' }}>Close</button>
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

