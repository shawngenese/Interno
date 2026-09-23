export const Colors = {
  // Apple System Colors
  white: "#FFFFFF",
  black: "#000000",
  labelPrimary: "#1D1D1F",
  labelSecondary: "#86868B",
  labelTertiary: "#CFCECE",
  separator: "#E5E5E7",
  systemBackground: "#F2F2F7",
  systemGreen: "#34C759",
  systemRed: "#FF3B30",
  systemYellow: "#FF9F0A",
  systemBlue: "#0A84FF",
  systemPurple: "#AF52DE",
  
  // Custom Trainee Management Colors — corporate blue (matches tokens.css / SAMPLE.HTML)
  primary: "#1D4ED8",
  primaryHover: "#1E40AF",
  secondary: "#86868B",
  success: "#34C759",
  warning: "#FF9F0A",
  error: "#FF3B30",
  
  // Backgrounds
  surface: "#FFFFFF",
  surfaceSecondary: "#F5F5F7",
  surfaceTertiary: "#EFEFF1",
  
  // Text Colors
  textPrimary: "#1D1D1F",
  textSecondary: "#86868B",
  textTertiary: "#CFCECE",
  textInverse: "#FFFFFF",
  
  // Borders
  border: "#CCCCCC",
  borderLight: "#E5E5E7",
}

export const Typography = {
  fontFamily: "'SF Pro Display', 'SF Pro Text', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 44,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    none: 1,
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.625,
  },
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
}

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
}

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 10,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
}

export const ZIndex = {
  base: 0,
  overlay: 10,
  modal: 100,
  dropdown: 50,
  sticky: 50,
}

export const Transition = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    easeOut: "cubic-bezier(0.0, 0, 0.2, 1)",
    easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  },
}