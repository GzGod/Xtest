import React, { useState, useMemo, useRef, useEffect } from 'react';
import Graph3D from './components/Graph3D';
import { INITIAL_DATA, LAST_UPDATED } from './constants';
import { SHARED_FOLLOWING_DATA } from './sharedFollowingData';
import { DEFAULT_LOCALE, ENGLISH_LOCALE, LOCALE_STORAGE_KEY, createTranslator, resolveInitialLocale } from './services/i18n.js';
import { computeSharedCandidates, mergeSharedCandidatesIntoGraph } from './services/sharedFollowing.js';
import { GraphData, GraphNode, SharedFollowingCandidateNode, SharedFollowingMode } from './types';
import { X as XIcon, Building2, Link2, ChevronLeft, ChevronRight, Menu, Calendar, BadgeCheck, MapPin, Search, HelpCircle, Sparkles, Users, RotateCcw, Plus, Check, Layers } from 'lucide-react';

const CATEGORY_LEGEND = [
  { key: 'company', color: '#FFD4A3', labelKey: 'legend.company' },
  { key: 'founder', color: '#A3D4FF', labelKey: 'legend.founder' },
  { key: 'researcher', color: '#E0B3FF', labelKey: 'legend.researcher' },
  { key: 'investor', color: '#B3FFB3', labelKey: 'legend.investor' },
  { key: 'media', color: '#FFB3D9', labelKey: 'legend.media' },
] as const;

const createCreatorProfile = (t: ReturnType<typeof createTranslator>): GraphNode => ({
  id: 'jenny_the_bunny',
  name: 'Jenny',
  handle: 'Jenny_the_Bunny',
  group: 'founder',
  role: t('creator.role'),
  bio: t('creator.bio'),
  joinedDate: t('creator.joined'),
  verified: 'blue',
});

export default function App() {
  const [data] = useState<GraphData>(INITIAL_DATA);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [showMethodology, setShowMethodology] = useState(false);
  const [locale, setLocale] = useState(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return resolveInitialLocale(savedLocale, window.navigator.language);
  });

  // Selection State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showCreatorCard, setShowCreatorCard] = useState(false);
  const [selectedSharedSourceIds, setSelectedSharedSourceIds] = useState<string[]>([]);
  const [sharedFollowingMode, setSharedFollowingMode] = useState<SharedFollowingMode>('threshold');
  const [minSharedCount, setMinSharedCount] = useState(2);
  const [candidateLimit, setCandidateLimit] = useState(20);
  const [expandedCandidates, setExpandedCandidates] = useState<SharedFollowingCandidateNode[]>([]);
  const [hasComputedSharedFollowing, setHasComputedSharedFollowing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Refs for scrolling
  const listContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const t = useMemo(() => createTranslator(locale), [locale]);
  const creatorProfile = useMemo(() => createCreatorProfile(t), [t]);
  const categoryLegend = useMemo(() => (
    CATEGORY_LEGEND.map((category) => ({
      ...category,
      label: t(category.labelKey),
    }))
  ), [t]);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile, auto-open on desktop
      if (mobile && isSidebarOpen && window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  // 1. Calculate Statistics & Sort Nodes by Followers (or connections as fallback)
  const sortedNodes = useMemo(() => {
    const counts = new Map<string, number>();

    // Count connections for each node ID
    data.links.forEach(link => {
        const s = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const t = typeof link.target === 'object' ? (link.target as any).id : link.target;
        counts.set(s, (counts.get(s) || 0) + 1);
        counts.set(t, (counts.get(t) || 0) + 1);
    });

    // Attach count to node copy and sort by followers (or connections as fallback)
    return [...data.nodes].map(node => ({
        ...node,
        val: counts.get(node.id) || 0
    })).sort((a, b) => (b.followers || b.val || 0) - (a.followers || a.val || 0));

  }, [data]);

  // Create a map of node ID to original rank (1-based)
  const nodeRankMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedNodes.forEach((node, idx) => {
      map.set(node.id, idx + 1);
    });
    return map;
  }, [sortedNodes]);

  const coreNodeById = useMemo(() => {
    return new Map(data.nodes.map((node) => [node.id, node]));
  }, [data.nodes]);

  const sharedSelectedNodes = useMemo(() => {
    return selectedSharedSourceIds
      .map((nodeId) => coreNodeById.get(nodeId))
      .filter((node): node is GraphNode => Boolean(node));
  }, [selectedSharedSourceIds, coreNodeById]);

  const computedSharedCandidates = useMemo<SharedFollowingCandidateNode[]>(() => {
    return computeSharedCandidates({
      selectedSourceIds: selectedSharedSourceIds,
      externalFollowingBySource: SHARED_FOLLOWING_DATA.externalFollowingBySource,
      candidateNodesById: SHARED_FOLLOWING_DATA.candidateNodesById,
      mode: sharedFollowingMode,
      minSharedCount,
    }) as SharedFollowingCandidateNode[];
  }, [selectedSharedSourceIds, sharedFollowingMode, minSharedCount]);

  const hasSharedFollowingDataset = useMemo(() => {
    return Object.keys(SHARED_FOLLOWING_DATA.externalFollowingBySource || {}).length > 0;
  }, []);

  // Filter nodes based on search query and selected category
  const filteredNodes = useMemo(() => {
    let nodes = sortedNodes;

    if (selectedCategory) {
      nodes = nodes.filter(node => node.group === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      nodes = nodes.filter(node => {
        const name = (node.name || '').toLowerCase();
        const handle = (node.handle || '').toLowerCase();
        const role = (node.role || '').toLowerCase();
        const associated = (node.associated || '').toLowerCase();
        const bio = (node.bio || '').toLowerCase();
        const bioTags = ((node as any).bioTags || []).join(' ').toLowerCase();

        return name.includes(query) ||
               handle.includes(query) ||
               role.includes(query) ||
               associated.includes(query) ||
               bio.includes(query) ||
               bioTags.includes(query);
      });
    }

    return nodes;
  }, [sortedNodes, searchQuery, selectedCategory]);

  // Build filtered graph data for the 3D view when a category is selected
  const filteredGraphData = useMemo(() => {
    if (!selectedCategory) return data;

    const filteredNodeIds = new Set(
      data.nodes.filter(n => n.group === selectedCategory).map(n => n.id)
    );

    return {
      nodes: data.nodes.filter(n => filteredNodeIds.has(n.id)),
      links: data.links.filter(link => {
        const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        return filteredNodeIds.has(sId) && filteredNodeIds.has(tId);
      }),
    };
  }, [data, selectedCategory]);

  const displayedGraphData = useMemo(() => {
    if (expandedCandidates.length === 0) {
      return filteredGraphData;
    }

    return mergeSharedCandidatesIntoGraph({
      baseData: filteredGraphData,
      candidates: expandedCandidates,
    });
  }, [filteredGraphData, expandedCandidates]);

  // Scroll to selected node in the sidebar
  useEffect(() => {
    if (selectedNode && itemRefs.current.has(selectedNode.id)) {
      const element = itemRefs.current.get(selectedNode.id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedNode]);

  useEffect(() => {
    setExpandedCandidates([]);
    setHasComputedSharedFollowing(false);
  }, [selectedSharedSourceIds, sharedFollowingMode, minSharedCount]);

  const nodeCount = data?.nodes?.length || 0;
  const linkCount = data?.links?.length || 0;

  const handleNodeClick = (node: GraphNode) => {
    setShowCreatorCard(false);
    if (selectedNode?.id === node.id) {
      setSelectedNode(null);
      return;
    }
    setSelectedNode(node);
    // Auto-close sidebar on mobile when selecting a node
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const toggleSharedSource = (node: GraphNode) => {
    if (node.isExternalCandidate) {
      return;
    }

    setSelectedSharedSourceIds((currentIds) =>
      currentIds.includes(node.id)
        ? currentIds.filter((nodeId) => nodeId !== node.id)
        : [...currentIds, node.id]
    );
  };

  const handleFindSharedFollowing = () => {
    setHasComputedSharedFollowing(true);
    setExpandedCandidates(computedSharedCandidates.slice(0, candidateLimit));
  };

  const handleClearSharedSelection = () => {
    setSelectedSharedSourceIds([]);
    setExpandedCandidates([]);
    setHasComputedSharedFollowing(false);
  };

  const handleCollapseCandidates = () => {
    setExpandedCandidates([]);
  };

  const closeSelection = () => {
    setSelectedNode(null);
    setShowCreatorCard(false);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(prev => prev === category ? null : category);
    setSelectedNode(null);
    setShowCreatorCard(false);
    setSelectedSharedSourceIds([]);
    setExpandedCandidates([]);
    setHasComputedSharedFollowing(false);
  };

  const getProfileImage = (node: GraphNode) => {
    if (node.imageUrl) return node.imageUrl;
    // Use Unavatar to get the Twitter/X profile picture
    if (node.handle) return `https://unavatar.io/twitter/${node.handle}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(node.name)}&background=random&color=fff&size=128`;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.onerror = null; // Prevent infinite loop
    if (selectedNode) {
        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedNode.name)}&background=1e293b&color=cbd5e1&size=128`;
    }
  };

  const formatNumber = (num: number | undefined): string => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const isNodeInSharedSelection = (nodeId: string) => {
    return selectedSharedSourceIds.includes(nodeId);
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-[#0B0C15] text-white font-sans">
      
      {/* 3D Graph Layer */}
      <Graph3D
        data={displayedGraphData}
        onNodeClick={handleNodeClick}
        onClearSelection={closeSelection}
        selectedNode={selectedNode}
        keepOrphans={!!selectedCategory}
        labels={{
          zoomOut: t('graph.zoomOut'),
          resetView: t('graph.reset'),
          zoomIn: t('graph.zoomIn'),
        }}
      />

      <div className={`absolute z-40 pointer-events-auto ${isMobile ? 'top-4 right-4' : 'top-6 right-6'}`}>
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#05060A]/80 p-1 backdrop-blur-xl shadow-lg">
          <span className="px-2 text-[11px] font-medium text-slate-400">{t('language.switcher')}</span>
          <button
            onClick={() => setLocale(DEFAULT_LOCALE)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${locale === DEFAULT_LOCALE ? 'bg-white text-black' : 'text-slate-300 hover:bg-white/10'}`}
          >
            {t('language.zh')}
          </button>
          <button
            onClick={() => setLocale(ENGLISH_LOCALE)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${locale === ENGLISH_LOCALE ? 'bg-white text-black' : 'text-slate-300 hover:bg-white/10'}`}
          >
            {t('language.en')}
          </button>
        </div>
      </div>

      {/* LEFT SIDEBAR - RANKED LIST */}
      <div
        className={`absolute top-0 left-0 h-full bg-[#05060A]/80 backdrop-blur-xl border-r border-white/10 z-30 transition-all duration-300 ease-in-out flex flex-col ${isMobile ? (isSidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-72') : (isSidebarOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-80')}`}
      >
        <div className="px-4 py-3 border-b border-white/10 bg-[#05060A]/50">
            <h1 className="text-xl font-display font-bold text-white tracking-tight">{t('app.title')}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{t('app.updatedAt', { date: LAST_UPDATED })}</p>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
            {filteredNodes.map((node, idx) => {
                const isSelected = selectedNode?.id === node.id;
                const isSharedSelected = isNodeInSharedSelection(node.id);
                return (
                    <div key={node.id} className="mb-1 flex items-stretch gap-1">
                        <button
                            ref={(el) => {
                                if (el) itemRefs.current.set(node.id, el);
                                else itemRefs.current.delete(node.id);
                            }}
                            onClick={() => handleNodeClick(node)}
                            className={`flex-1 text-left p-3 rounded-xl flex items-center gap-3 transition-all duration-200 border ${isSelected ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-900/20' : 'hover:bg-white/5 border-transparent'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                               {nodeRankMap.get(node.id)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5 truncate">
                                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                        {node.name}
                                    </span>
                                    {node.handle && (
                                        <span className="text-xs text-slate-500 font-mono truncate">
                                            @{node.handle}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <span className="text-xs text-slate-500 truncate flex-1">
                                        {node.role
                                          ? `${node.role}${node.associated && node.associated !== node.name ? ` @ ${node.associated}` : ''}`
                                          : '\u00A0'}
                                    </span>
                                    <span className="text-[10px] text-slate-600 whitespace-nowrap shrink-0">
                                        {node.followers
                                          ? node.followers >= 1000000
                                            ? `${(node.followers / 1000000).toFixed(1)}M`
                                            : `${Math.round(node.followers / 1000)}K`
                                          : t('common.connections', { count: node.val })}
                                    </span>
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => toggleSharedSource(node)}
                            aria-label={isSharedSelected ? t('shared.removeAria', { name: node.name }) : t('shared.addAria', { name: node.name })}
                            className={`w-10 rounded-xl border transition-all duration-200 flex items-center justify-center ${isSharedSelected ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                            title={isSharedSelected ? t('shared.remove') : t('shared.add')}
                        >
                            {isSharedSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                    </div>
                )
            })}
        </div>

        {/* Creator Profile */}
        <div className="border-t border-white/10 bg-[#05060A]/50 p-2">
          <button
            onClick={() => {
              setSelectedNode(null);
              setShowCreatorCard(true);
            }}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all duration-200 border ${showCreatorCard ? 'bg-indigo-600/20 border-indigo-500/50' : 'hover:bg-white/5 border-transparent'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${showCreatorCard ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
              x
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 truncate">
                <span className={`text-sm font-semibold ${showCreatorCard ? 'text-white' : 'text-slate-200'}`}>
                  Jenny
                </span>
                <span className="text-xs text-slate-500 font-mono truncate">
                  @Jenny_the_Bunny
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 truncate">
                  {t('creator.role')}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute top-6 z-40 p-2 bg-slate-800/80 text-white border border-white/10 rounded-r-lg hover:bg-slate-700 transition-all duration-300 ${isMobile ? (isSidebarOpen ? 'left-72' : 'left-0') : (isSidebarOpen ? 'left-80' : 'left-0')}`}
      >
        {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>


      {/* FLOATING DETAILS CARD (Replacing Right Sidebar) */}
      {(selectedNode || showCreatorCard) && (
        <div className={`fixed z-50 animate-in fade-in duration-300 pointer-events-none flex flex-col gap-4 ${isMobile ? 'bottom-20 left-4 right-4 w-auto' : 'top-6 right-6 w-[400px] max-w-[calc(100vw-48px)] slide-in-from-right-10'}`}>

            {/* Creator Card */}
            {showCreatorCard && (
                <div className="bg-[#090A10]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto relative overflow-hidden group">

                    {/* Header Banner */}
                    <div className="h-24 bg-gradient-to-br from-pink-900/50 via-slate-800/50 to-indigo-900/30 relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090A10]/80 to-transparent" />
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={closeSelection}
                        className="absolute top-3 right-3 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-colors z-20 backdrop-blur-sm"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    {/* Profile Section */}
                    <div className="px-4 pb-4 relative">
                        {/* Avatar - Overlapping Header */}
                        <div className="flex justify-between items-start">
                            <div className="relative -mt-12 mb-3">
                                <img
                                    src={getProfileImage(creatorProfile)}
                                    alt={creatorProfile.name}
                                    onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorProfile.name)}&background=1e293b&color=cbd5e1&size=128`;
                                    }}
                                    className="w-20 h-20 rounded-full border-4 border-[#090A10] object-cover bg-slate-800 shadow-lg"
                                />
                            </div>

                            {/* Follow Button */}
                            <a
                                href={`https://x.com/${creatorProfile.handle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 px-5 py-2 bg-white hover:bg-white/90 text-black font-bold text-sm rounded-full transition-all"
                            >
                                {t('common.follow')}
                            </a>
                        </div>

                        {/* Name & Handle */}
                        <div className="mb-3">
                            <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
                                {creatorProfile.name}
                                <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20" />
                            </h2>
                            <div className="text-slate-500 text-sm">@{creatorProfile.handle}</div>
                        </div>

                        {/* Bio */}
                        <p className="text-sm text-slate-200 leading-relaxed mb-3">
                            {creatorProfile.bio}
                        </p>

                        {/* Meta Info Row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mb-4">
                            <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{t('common.joined', { value: creatorProfile.joinedDate })}</span>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Content Cards */}
            {selectedNode && (
                <>
                {/* Main Profile Card - X Style */}
                <div className="bg-[#090A10]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto relative overflow-hidden group">

                    {/* Header Banner */}
                    <div className="h-24 bg-gradient-to-br from-indigo-900/50 via-slate-800/50 to-purple-900/30 relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090A10]/80 to-transparent" />
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={closeSelection}
                        className="absolute top-3 right-3 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-colors z-20 backdrop-blur-sm"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    {/* Profile Section */}
                    <div className="px-4 pb-4 relative">
                        {/* Avatar - Overlapping Header */}
                        <div className="flex justify-between items-start">
                            <div className="relative -mt-12 mb-3">
                                <img
                                    src={getProfileImage(selectedNode)}
                                    alt={selectedNode.name}
                                    onError={handleImageError}
                                    className="w-20 h-20 rounded-full border-4 border-[#090A10] object-cover bg-slate-800 shadow-lg"
                                />
                                {selectedNode.group === 'company' && (
                                    <div className="absolute -bottom-1 -right-1 bg-[#090A10] rounded-full p-1">
                                        <Building2 className="w-4 h-4 text-amber-400" />
                                    </div>
                                )}
                            </div>

                            {/* Follow Button */}
                            {selectedNode.handle && (
                                <a
                                    href={`https://x.com/${selectedNode.handle}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 px-5 py-2 bg-white hover:bg-white/90 text-black font-bold text-sm rounded-full transition-all"
                                >
                                    {t('common.follow')}
                                </a>
                            )}
                        </div>

                        {/* Name & Handle */}
                        <div className="mb-3">
                            <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
                                {selectedNode.name}
                                {selectedNode.verified === 'gold' && <BadgeCheck className="w-5 h-5 text-amber-400 fill-amber-400/20" />}
                                {selectedNode.verified === 'blue' && <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20" />}
                            </h2>
                            <div className="text-slate-500 text-sm">@{selectedNode.handle}</div>
                        </div>

                        {/* Bio */}
                        {(selectedNode.bio || selectedNode.role) && (
                            <p className="text-sm text-slate-200 leading-relaxed mb-3">
                                {selectedNode.bio || `${selectedNode.role}${selectedNode.associated ? ` @ ${selectedNode.associated}` : ''}`}
                            </p>
                        )}

                        {/* Meta Info Row: Location, Website, Joined */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mb-4">
                            {selectedNode.location && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    <span>{selectedNode.location}</span>
                                </div>
                            )}
                            {selectedNode.website && (
                                <a
                                    href={`https://${selectedNode.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-indigo-400 hover:underline"
                                >
                                    <Link2 className="w-4 h-4" />
                                    <span>{selectedNode.website}</span>
                                </a>
                            )}
                            {selectedNode.joinedDate && (
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{t('common.joined', { value: selectedNode.joinedDate })}</span>
                                </div>
                            )}
                        </div>

                        {/* Following / Followers */}
                        {(selectedNode.followers || selectedNode.following) && (
                            <div className="flex gap-4 text-sm">
                                {selectedNode.following !== undefined && (
                                    <div>
                                        <span className="font-bold text-white">{formatNumber(selectedNode.following)}</span>
                                        <span className="text-slate-500 ml-1">{t('common.following')}</span>
                                    </div>
                                )}
                                {selectedNode.followers !== undefined && (
                                    <div>
                                        <span className="font-bold text-white">{formatNumber(selectedNode.followers)}</span>
                                        <span className="text-slate-500 ml-1">{t('common.followers')}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedNode.isExternalCandidate && (
                            <div className="mt-4 space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs font-medium">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {t('shared.candidateBadge')}
                                </div>
                                <div className="text-xs text-slate-400 leading-relaxed">
                                    {t('shared.candidateDetails', {
                                      count: selectedNode.sharedFollowerCount || 0,
                                      accounts: (selectedNode.followedBySelectedIds || [])
                                        .map((nodeId) => coreNodeById.get(nodeId)?.handle || coreNodeById.get(nodeId)?.name || nodeId)
                                        .join(', '),
                                    })}
                                </div>
                            </div>
                        )}

                        {!selectedNode.isExternalCandidate && (
                            <div className="mt-4 flex items-center gap-2">
                                <button
                                    onClick={() => toggleSharedSource(selectedNode)}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${isNodeInSharedSelection(selectedNode.id) ? 'border-amber-400/50 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                                >
                                    {isNodeInSharedSelection(selectedNode.id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    {isNodeInSharedSelection(selectedNode.id) ? t('shared.added') : t('shared.add')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                </>
            )}

        </div>
      )}

      {selectedSharedSourceIds.length > 0 && (
        <div className={`absolute z-30 pointer-events-auto ${isMobile ? 'bottom-24 left-4 right-4' : 'bottom-28 right-6 w-[360px] max-w-[calc(100vw-48px)]'}`}>
          <div className="bg-[#090A10]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Users className="w-4 h-4 text-amber-300" />
                    {t('shared.title')}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {sharedSelectedNodes.map((node) => node.handle || node.name).join(', ')}
                  </div>
                </div>
                <div className="text-xs text-slate-400 whitespace-nowrap">
                  {t('shared.selectedCount', { count: selectedSharedSourceIds.length })}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-400">
                  {t('shared.mode')}
                  <select
                    value={sharedFollowingMode}
                    onChange={(e) => setSharedFollowingMode(e.target.value as SharedFollowingMode)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="threshold">{t('shared.modeThreshold')}</option>
                    <option value="strict">{t('shared.modeStrict')}</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  {t('shared.expand')}
                  <select
                    value={candidateLimit}
                    onChange={(e) => setCandidateLimit(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value={10}>{t('shared.topN', { count: 10 })}</option>
                    <option value={20}>{t('shared.topN', { count: 20 })}</option>
                    <option value={50}>{t('shared.topN', { count: 50 })}</option>
                  </select>
                </label>
              </div>

              {sharedFollowingMode === 'threshold' && (
                <label className="block text-xs text-slate-400">
                  {t('shared.minSharedCount')}
                  <select
                    value={Math.min(minSharedCount, Math.max(1, selectedSharedSourceIds.length))}
                    onChange={(e) => setMinSharedCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {Array.from({ length: selectedSharedSourceIds.length }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {t('shared.atLeastCount', { count })}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleFindSharedFollowing}
                  disabled={!hasSharedFollowingDataset}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${hasSharedFollowingDataset ? 'bg-amber-300 text-black hover:bg-amber-200' : 'bg-amber-300/40 text-slate-900/70 cursor-not-allowed'}`}
                >
                  <Sparkles className="w-4 h-4" />
                  {t('shared.find')}
                </button>
                <button
                  onClick={handleClearSharedSelection}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-slate-200 text-sm hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('shared.clearSelection')}
                </button>
                {expandedCandidates.length > 0 && (
                  <button
                    onClick={handleCollapseCandidates}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-slate-200 text-sm hover:bg-white/10 transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    {t('shared.collapseCandidates')}
                  </button>
                )}
              </div>

              {!hasSharedFollowingDataset && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
                  {t('shared.datasetMissing', {
                    command: 'npm run generate-shared-following',
                    env: 'XAPI_API_KEY',
                  })}
                </div>
              )}

              {hasSharedFollowingDataset && hasComputedSharedFollowing && computedSharedCandidates.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
                  {t('shared.empty')}
                </div>
              )}

              {hasSharedFollowingDataset && hasComputedSharedFollowing && computedSharedCandidates.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03]">
                  <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-3">
                    <div className="text-sm text-white font-medium">
                      {t('shared.resultsTitle')}
                    </div>
                    <div className="text-xs text-slate-400">
                      {t('shared.resultsShowing', {
                        shown: expandedCandidates.length,
                        total: computedSharedCandidates.length,
                      })}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    {computedSharedCandidates.slice(0, candidateLimit).map((candidate) => (
                      <button
                        key={candidate.id}
                        onClick={() => handleNodeClick(candidate)}
                        className={`w-full text-left px-3 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.04] transition-colors ${selectedNode?.id === candidate.id ? 'bg-amber-300/10' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {candidate.name}
                            </div>
                            <div className="text-xs text-amber-200 font-mono truncate">
                              @{candidate.handle}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-400 whitespace-nowrap">
                            {formatNumber(candidate.followers)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {candidate.bio || candidate.role || t('common.noBio')}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="px-2 py-1 rounded-full bg-amber-300/10 text-amber-200 border border-amber-300/15">
                            {t('shared.sharedFollows', { count: candidate.sharedFollowerCount })}
                          </span>
                          {candidate.isLikelyCommercialKOL && (
                            <span className="px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-200 border border-emerald-400/15">
                              {t('shared.kolLeaning')}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={`absolute z-20 bg-[#0B0C15]/80 backdrop-blur-md border border-white/10 rounded-xl transition-all duration-300 ease-in-out ${isMobile ? 'top-20 right-4' : 'bottom-6 right-6'} ${isLegendOpen ? 'p-4' : 'p-2'}`}>
        <button
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="flex items-center gap-2 w-full text-left"
        >
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">{t('legend.title')}</div>
          <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${isLegendOpen ? 'rotate-90' : ''}`} />
        </button>
        <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ease-in-out ${isLegendOpen ? 'mt-3 max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
          {categoryLegend.map(cat => (
            <button
              key={cat.key}
              onClick={() => handleCategoryClick(cat.key)}
              className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-200 text-left ${selectedCategory === cat.key ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'} ${selectedCategory && selectedCategory !== cat.key ? 'opacity-40' : 'opacity-100'}`}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color, boxShadow: `0 0 8px ${cat.color}` }} />
              <span className="text-xs text-slate-300">{cat.label}</span>
            </button>
          ))}
          {selectedCategory && (
            <button
              onClick={() => { setSelectedCategory(null); setSelectedNode(null); }}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors mt-1 px-2"
            >
              {t('common.clearFilter')}
            </button>
          )}
          {expandedCandidates.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-amber-300/5 border border-amber-300/10">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#F6D365', boxShadow: '0 0 8px #F6D365' }} />
              <span className="text-xs text-amber-100">{t('legend.candidate')}</span>
            </div>
          )}
          <div className="border-t border-white/10 my-2" />
          <button
            onClick={() => setShowMethodology(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{t('legend.methodology')}</span>
          </button>
        </div>
      </div>

      {/* Methodology Modal */}
      {showMethodology && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMethodology(false)}
          />

          {/* Modal */}
          <div className="relative bg-[#0B0C15] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-[#0B0C15] border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{t('method.title')}</h2>
              <button
                onClick={() => setShowMethodology(false)}
                className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-3 space-y-2.5">
              <div>
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">{t('method.discoveryTitle')}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('method.discoveryBody')}
                </p>
                <div className="bg-slate-800/50 border border-white/10 rounded-md px-2.5 py-1.5 font-mono text-xs text-white mt-1.5 mb-1">
                  {t('method.scoreFormula')}
                </div>
                <p className="text-xs text-slate-400">
                  {t('method.discoveryNote')}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">{t('method.graphTitle')}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('method.graphBody')}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">{t('method.sharedTitle')}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('method.sharedBody')}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-slate-400">
                  {t('method.feedback')}{' '}
                  <a
                    href="https://x.com/Jenny_the_Bunny"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    {t('method.feedbackLink')}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        @keyframes moveRight {
          0% { left: -6px; }
          100% { left: calc(100% + 6px); }
        }
      `}</style>
    </div>
  );
}
