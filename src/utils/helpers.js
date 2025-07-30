/**
 * 유틸리티 헬퍼 함수들
 */

// 색상 변환 유틸리티
const ColorUtils = {
  // RGB를 HEX로 변환
  rgbToHex: (r, g, b) => {
    const toHex = (n) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  // HEX를 RGB로 변환
  hexToRgb: (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : null;
  },

  // 색상 대비 계산
  getContrastRatio: (color1, color2) => {
    const getLuminance = (color) => {
      const rgb = typeof color === 'string' ? ColorUtils.hexToRgb(color) : color;
      if (!rgb) return 0;
      
      const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }
};

// 문자열 유틸리티
const StringUtils = {
  // 카멜케이스로 변환
  toCamelCase: (str) => {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  },

  // 파스칼케이스로 변환
  toPascalCase: (str) => {
    return str.charAt(0).toUpperCase() + StringUtils.toCamelCase(str.slice(1));
  },

  // 케밥케이스로 변환
  toKebabCase: (str) => {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  },

  // 스네이크케이스로 변환
  toSnakeCase: (str) => {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  },

  // 안전한 파일명 생성
  sanitizeFileName: (str) => {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }
};

// 배열 유틸리티
const ArrayUtils = {
  // 중복 제거
  unique: (arr) => {
    return [...new Set(arr)];
  },

  // 그룹화
  groupBy: (arr, key) => {
    return arr.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  // 평면화
  flatten: (arr) => {
    return arr.reduce((flat, item) => {
      return flat.concat(Array.isArray(item) ? ArrayUtils.flatten(item) : item);
    }, []);
  }
};

// 객체 유틸리티
const ObjectUtils = {
  // 깊은 복사
  deepClone: (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => ObjectUtils.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = ObjectUtils.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  },

  // 객체 병합
  merge: (target, ...sources) => {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (source && typeof source === 'object') {
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {};
            ObjectUtils.merge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
    }
    
    return ObjectUtils.merge(target, ...sources);
  }
};

// 검증 유틸리티
const ValidationUtils = {
  // 이메일 검증
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // URL 검증
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // 피그마 파일 키 검증
  isValidFigmaFileKey: (fileKey) => {
    const figmaKeyRegex = /^[a-zA-Z0-9]{22,}$/;
    return figmaKeyRegex.test(fileKey);
  },

  // 필수 필드 검증
  validateRequired: (obj, requiredFields) => {
    const missing = [];
    requiredFields.forEach(field => {
      if (!obj[field] || obj[field] === '') {
        missing.push(field);
      }
    });
    return missing.length === 0 ? null : missing;
  }
};

// 파일 유틸리티
const FileUtils = {
  // 파일 확장자 가져오기
  getExtension: (filename) => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  },

  // 파일 크기 포맷팅
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // 안전한 파일명 생성
  generateSafeFileName: (originalName, extension) => {
    const timestamp = Date.now();
    const sanitizedName = StringUtils.sanitizeFileName(originalName);
    return `${sanitizedName}_${timestamp}.${extension}`;
  }
};

// 로깅 유틸리티
const LogUtils = {
  // 로그 레벨
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },

  currentLevel: 2, // INFO

  log: (level, message, data = null) => {
    if (level <= LogUtils.currentLevel) {
      const timestamp = new Date().toISOString();
      const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
      const levelName = levelNames[level];
      
      console.log(`[${timestamp}] ${levelName}: ${message}`);
      if (data) {
        console.log(data);
      }
    }
  },

  error: (message, data) => LogUtils.log(LogUtils.levels.ERROR, message, data),
  warn: (message, data) => LogUtils.log(LogUtils.levels.WARN, message, data),
  info: (message, data) => LogUtils.log(LogUtils.levels.INFO, message, data),
  debug: (message, data) => LogUtils.log(LogUtils.levels.DEBUG, message, data)
}; 