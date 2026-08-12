import { describe, expect, it, vi } from 'vitest';

import { requestDestructiveConfirmation } from './destructive-confirmation';

describe('confirmation destructive multiplateforme', () => {
  it('exécute l’action sur web après confirmation', () => {
    const action = vi.fn();
    requestDestructiveConfirmation({
      platform: 'web',
      title: 'Déconnexion',
      body: 'Confirmer ?',
      cancelLabel: 'Annuler',
      confirmLabel: 'Déconnexion',
      action,
      webConfirm: () => true,
      nativeAlert: vi.fn(),
    });
    expect(action).toHaveBeenCalledOnce();
  });

  it('n’exécute pas l’action sur web après annulation', () => {
    const action = vi.fn();
    requestDestructiveConfirmation({
      platform: 'web',
      title: 'Déconnexion',
      body: 'Confirmer ?',
      cancelLabel: 'Annuler',
      confirmLabel: 'Déconnexion',
      action,
      webConfirm: () => false,
      nativeAlert: vi.fn(),
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('délègue la confirmation à l’alerte native avec une action destructive', () => {
    const action = vi.fn();
    const nativeAlert = vi.fn();
    requestDestructiveConfirmation({
      platform: 'native',
      title: 'Déconnexion',
      body: 'Confirmer ?',
      cancelLabel: 'Annuler',
      confirmLabel: 'Déconnexion',
      action,
      webConfirm: vi.fn(),
      nativeAlert,
    });

    const buttons = nativeAlert.mock.calls[0][2];
    expect(buttons[1].style).toBe('destructive');
    buttons[1].onPress();
    expect(action).toHaveBeenCalledOnce();
  });
});
