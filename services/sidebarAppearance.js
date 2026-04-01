const TOGGLE_SIZE_CLASSES = 'w-14 min-h-[92px] rounded-[22px]';

export function getSharedToggleAppearance(isSelected = false) {
  if (isSelected) {
    return {
      icon: 'check',
      sizeClasses: TOGGLE_SIZE_CLASSES,
      buttonClasses: `${TOGGLE_SIZE_CLASSES} border border-[#C7A74A]/70 bg-[linear-gradient(180deg,rgba(84,63,16,0.96),rgba(38,31,12,0.98))] text-[#F3D56B] shadow-[inset_0_1px_0_rgba(255,244,190,0.12),0_18px_34px_rgba(111,80,18,0.28)] hover:border-[#E4C765]/80 hover:text-[#FFE08A]`,
      iconClasses: 'w-[18px] h-[18px] stroke-[2.3]',
    };
  }

  return {
    icon: 'plus',
    sizeClasses: TOGGLE_SIZE_CLASSES,
    buttonClasses: `${TOGGLE_SIZE_CLASSES} border border-white/[0.08] bg-[linear-gradient(180deg,rgba(20,25,35,0.94),rgba(11,15,23,0.98))] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_32px_rgba(0,0,0,0.26)] hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white`,
    iconClasses: 'w-[18px] h-[18px] stroke-[2.2]',
  };
}

export function getSidebarRowAppearance(isSelected = false) {
  if (isSelected) {
    return {
      rowClasses: 'border border-indigo-400/35 bg-[linear-gradient(135deg,rgba(30,41,59,0.78),rgba(23,37,84,0.6))] shadow-[0_20px_45px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.05)]',
      rankClasses: 'bg-[linear-gradient(180deg,rgba(99,102,241,0.4),rgba(49,46,129,0.5))] text-white shadow-[0_10px_25px_rgba(79,70,229,0.24)]',
      nameClasses: 'text-white',
      handleClasses: 'text-indigo-100/70',
      metaClasses: 'text-slate-200/82',
      metricClasses: 'border border-indigo-300/20 bg-indigo-300/10 text-indigo-100',
    };
  }

  return {
    rowClasses: 'border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] shadow-[0_16px_34px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-white/[0.11] hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))]',
    rankClasses: 'bg-[linear-gradient(180deg,rgba(30,41,59,0.95),rgba(15,23,42,0.95))] text-slate-200',
    nameClasses: 'text-slate-50',
    handleClasses: 'text-slate-400',
    metaClasses: 'text-slate-400/90',
    metricClasses: 'border border-white/[0.08] bg-white/[0.04] text-slate-300',
  };
}

export function getSidebarToggleButtonClasses(isMobile, isOpen) {
  return `absolute top-6 z-40 flex h-12 w-12 items-center justify-center rounded-r-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(24,33,48,0.92),rgba(14,18,28,0.96))] text-slate-100 shadow-[0_16px_36px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-all duration-300 hover:border-white/[0.14] hover:text-white ${isMobile ? (isOpen ? 'left-72' : 'left-3') : (isOpen ? 'left-80' : 'left-3')}`;
}
