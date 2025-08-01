import React from 'react';

// Mock Icon component for web
const Icon: React.FC<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
  [key: string]: any;
}> = ({ name, size = 24, color = '#000', style, ...props }) => {
  // Simple icon fallback using Unicode symbols or text
  const getIconText = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'home': '🏠',
      'people': '👥',
      'person': '👤',
      'medical': '🏥',
      'calendar': '📅',
      'add': '+',
      'add-circle-outline': '➕',
      'close': '✕',
      'notifications': '🔔',
      'notifications-outline': '🔔',
      'settings': '⚙️',
      'menu': '☰',
      'search': '🔍',
      'heart': '❤️',
      'star': '⭐',
      'check': '✓',
      'arrow-back': '←',
      'arrow-forward': '→',
      'chevron-down': '▼',
      'chevron-up': '▲',
      'document-text-outline': '📄',
      'alarm-outline': '⏰',
      'calendar-outline': '📅',
      'medical-outline': '🏥',
    };
    
    return iconMap[iconName] || '?';
  };

  return (
    <span
      style={{
        fontSize: size,
        color,
        display: 'inline-block',
        lineHeight: 1,
        ...style,
      }}
      {...props}
    >
      {getIconText(name)}
    </span>
  );
};

export default Icon;