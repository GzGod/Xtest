import test from 'node:test';
import assert from 'node:assert/strict';

import { getSharedToggleAppearance } from '../../services/sidebarAppearance.js';

test('shared toggle keeps a consistent geometry while switching icons by state', () => {
  const defaultAppearance = getSharedToggleAppearance(false);
  const selectedAppearance = getSharedToggleAppearance(true);

  assert.equal(defaultAppearance.sizeClasses, selectedAppearance.sizeClasses);
  assert.equal(defaultAppearance.icon, 'plus');
  assert.equal(selectedAppearance.icon, 'check');
});

test('shared toggle selected state uses the gold-accented treatment', () => {
  const defaultAppearance = getSharedToggleAppearance(false);
  const selectedAppearance = getSharedToggleAppearance(true);

  assert.match(defaultAppearance.buttonClasses, /text-slate-300/);
  assert.match(selectedAppearance.buttonClasses, /C7A74A|F3D56B/);
});
