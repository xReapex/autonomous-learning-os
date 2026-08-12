type AlertButton = {
  text: string;
  style?: 'cancel' | 'destructive';
  onPress?: () => void;
};

type DestructiveConfirmationOptions = {
  platform: 'web' | 'native';
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  action: () => void;
  webConfirm: (message: string) => boolean;
  nativeAlert: (title: string, body: string, buttons: AlertButton[]) => void;
};

export function requestDestructiveConfirmation({
  action,
  body,
  cancelLabel,
  confirmLabel,
  nativeAlert,
  platform,
  title,
  webConfirm,
}: DestructiveConfirmationOptions): void {
  if (platform === 'web') {
    if (webConfirm(`${title}\n\n${body}`)) action();
    return;
  }

  nativeAlert(title, body, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: action },
  ]);
}
