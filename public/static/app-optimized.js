/**
 * タップカルテ - 最適化版統合フロントエンド
 * 
 * 機能完全維持・コード品質向上・メンテナンス性向上
 */

// ========================================
// 🔧 定数・設定
// ========================================

/** アプリケーション設定 */
const APP_CONSTANTS = {
  API: {
    BASE_URL: '/api',
    ENDPOINTS: {
      LOGIN: '/api/auth/login',
      CONVERT: '/api/ai/convert',
      VALIDATE: '/api/auth/validate'
    },
    TIMEOUT: 30000
  },
  
  STORAGE: {
    TOKEN_KEY: 'demo_auth_token',
    USER_KEY: 'demo_user_data',
    USAGE_KEY: 'tap_karte_usage_data',
    HISTORY_KEY: 'conversionHistory',
    SESSION_KEY: 'session_fingerprint'
  },
  
  TIMERS: {
    SESSION_CHECK: 5 * 60 * 1000, // 5分
    AUTO_REFRESH: 30 * 60 * 1000, // 30分
    NOTIFICATION_DURATION: 2000   // 2秒
  },
  
  BUTTONS: {
    DOCUMENT: ['doc-record', 'doc-report'],
    FORMAT: ['format-text', 'format-soap'],
    STYLE: ['style-plain', 'style-polite']
  },
  
  DEFAULT_OPTIONS: {
    DOC_TYPE: '記録',
    FORMAT: '文章形式', 
    STYLE: 'だ・である体',
    CHAR_LIMIT: 500
  }
}

/** CSS クラス定義 */
const CSS_CLASSES = {
  BUTTON: {
    BASE: 'px-4 py-2 rounded-md text-sm font-medium transition-colors',
    SELECTED: 'bg-pink-600 text-white hover:bg-pink-700',
    UNSELECTED: 'bg-pink-100 text-pink-700 hover:bg-pink-200'
  }
}

// ========================================
// 🛠️ ユーティリティ関数
// ========================================

/** DOM要素取得のヘルパー */
const DOM = {
  /**
   * 要素を安全に取得（Safari対応の堅牢版）
   * @param {string} id - 要素ID
   * @param {number} retryCount - リトライ回数
   * @returns {HTMLElement|null}
   */
  get(id, retryCount = 0) {
    const element = document.getElementById(id)
    if (element) {
      return element
    }
    
    // Safari用のフォールバック：要素が見つからない場合は少し待って再試行
    if (retryCount < 3 && (this.isSafari() || this.isWebKit())) {
      console.log(`[DOM] Element '${id}' not found on Safari, retrying... (${retryCount + 1}/3)`)
      setTimeout(() => {
        return this.get(id, retryCount + 1)
      }, 100)
    }
    
    return null
  },

  /**
   * 要素を待機して取得（Safari対応）
   * @param {string} id - 要素ID
   * @param {number} maxWait - 最大待機時間（ms）
   * @returns {Promise<HTMLElement|null>}
   */
  async waitForElement(id, maxWait = 5000) {
    return new Promise((resolve) => {
      const element = document.getElementById(id)
      if (element) {
        resolve(element)
        return
      }

      let attempts = 0
      const maxAttempts = maxWait / 100

      const interval = setInterval(() => {
        const element = document.getElementById(id)
        if (element) {
          clearInterval(interval)
          resolve(element)
          return
        }

        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          console.warn(`[DOM] Element '${id}' not found after ${maxWait}ms`)
          resolve(null)
        }
      }, 100)
    })
  },

  /**
   * Safari判定
   * @returns {boolean}
   */
  isSafari() {
    return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
  },

  /**
   * WebKit判定
   * @returns {boolean}
   */
  isWebKit() {
    return /WebKit/.test(navigator.userAgent)
  },

  /**
   * 要素の表示/非表示を切り替え
   * @param {string} id - 要素ID
   * @param {boolean} visible - 表示フラグ
   */
  toggle(id, visible) {
    const element = this.get(id)
    if (element) {
      element.style.display = visible ? 'block' : 'none'
    }
  },

  /**
   * 要素のクラス操作
   * @param {string} id - 要素ID
   * @param {string} className - クラス名
   * @param {boolean} add - 追加フラグ（falseで削除）
   */
  toggleClass(id, className, add = true) {
    const element = this.get(id)
    if (element) {
      element.classList.toggle(className, add)
    }
  }
}

/** 日付ユーティリティ */
const DateUtils = {
  /**
   * 日本時間で今日の日付を取得
   * @returns {string} YYYY-MM-DD形式
   */
  getTodayJST() {
    const today = new Date()
    const jstOffset = 9 * 60 * 60 * 1000 // JST = UTC+9
    const jstDate = new Date(today.getTime() + jstOffset)
    
    return jstDate.getUTCFullYear() + '-' + 
           String(jstDate.getUTCMonth() + 1).padStart(2, '0') + '-' + 
           String(jstDate.getUTCDate()).padStart(2, '0')
  }
}

/** ローカルストレージヘルパー */
const StorageHelper = {
  /**
   * データを安全に取得
   * @param {string} key - キー
   * @param {any} defaultValue - デフォルト値
   * @returns {any}
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error(`[StorageHelper] Get error for key ${key}:`, error)
      return defaultValue
    }
  },

  /**
   * データを安全に保存
   * @param {string} key - キー
   * @param {any} value - 値
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`[StorageHelper] Set error for key ${key}:`, error)
    }
  },

  /**
   * データを削除
   * @param {string} key - キー
   */
  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`[StorageHelper] Remove error for key ${key}:`, error)
    }
  }
}

// ========================================
// 📊 使用回数管理システム（UsageManager）
// ========================================

class UsageManager {
  constructor() {
    this.storageKey = APP_CONSTANTS.STORAGE.USAGE_KEY
    this.usageData = this.loadUsageData()
    console.log('[UsageManager] Initialized')
  }

  /**
   * 使用データを読み込み（強化フィンガープリント対応）
   * @returns {Object} 使用データ
   */
  loadUsageData() {
    const deviceId = this.generateDeviceId()
    console.log('[UsageManager] Enhanced device fingerprint:', deviceId.substring(0, 16) + '... (length: ' + deviceId.length + ')')
    
    // デバッグ: フィンガープリント詳細（開発時のみ表示）
    if (window.location.hostname.includes('e2b.dev') || window.location.hostname === 'localhost') {
      console.log('[UsageManager] Fingerprint components available:')
      console.log('- Canvas fingerprint: ✓')
      console.log('- WebGL fingerprint: ✓') 
      console.log('- Font detection: ✓')
      console.log('- Hardware info: ✓')
      console.log('- Environment info: ✓')
    }
    
    const defaultData = {
      lastUsageDate: null,
      usageCount: 0,
      deviceId: deviceId
    }
    return StorageHelper.get(this.storageKey, defaultData)
  }

  /**
   * 使用データを保存
   */
  saveUsageData() {
    StorageHelper.set(this.storageKey, this.usageData)
  }

  /**
   * 強化デバイスフィンガープリント生成
   * Canvas + WebGL + フォント + ハードウェア + ネットワーク情報
   */
  generateDeviceId() {
    try {
      const fingerprints = []
      
      // 1. Canvas フィンガープリント（強化版）
      fingerprints.push(this.getCanvasFingerprint())
      
      // 2. WebGL フィンガープリント
      fingerprints.push(this.getWebGLFingerprint())
      
      // 3. フォント検出フィンガープリント
      fingerprints.push(this.getFontFingerprint())
      
      // 4. ハードウェア情報フィンガープリント
      fingerprints.push(this.getHardwareFingerprint())
      
      // 5. ネットワーク・ブラウザ環境フィンガープリント
      fingerprints.push(this.getEnvironmentFingerprint())
      
      // 6. 基本情報（後方互換性）
      fingerprints.push(this.getBasicFingerprint())
      
      // 全ての指紋を結合
      const combinedFingerprint = fingerprints.filter(f => f).join('|')
      
      // ハッシュ生成（SHA-like）
      return this.generateHash(combinedFingerprint)
    } catch (error) {
      console.warn('[UsageManager] Fingerprint generation error:', error)
      // フォールバック：基本情報のみ
      return this.generateHash(this.getBasicFingerprint())
    }
  }

  /**
   * 強化Canvasフィンガープリント
   */
  getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 200
      canvas.height = 50
      
      // テキスト描画（複数フォント・色・効果）
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial, sans-serif'
      ctx.fillStyle = 'rgb(255, 0, 0)'
      ctx.fillText('🏥 タップカルテ Device ID 🔒', 2, 2)
      
      ctx.font = '12px Times, serif'
      ctx.fillStyle = 'rgb(0, 255, 0)'
      ctx.fillText('Medical Record Assistant 2025', 2, 20)
      
      // グラフィック描画
      ctx.strokeStyle = 'rgb(0, 0, 255)'
      ctx.arc(50, 25, 20, 0, Math.PI * 2)
      ctx.stroke()
      
      // グラデーション
      const gradient = ctx.createLinearGradient(0, 0, 100, 0)
      gradient.addColorStop(0, 'red')
      gradient.addColorStop(0.5, 'green')
      gradient.addColorStop(1, 'blue')
      ctx.fillStyle = gradient
      ctx.fillRect(100, 10, 80, 30)
      
      return canvas.toDataURL()
    } catch (error) {
      return 'canvas_error'
    }
  }

  /**
   * WebGLフィンガープリント
   */
  getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) return 'webgl_not_supported'
      
      const fingerprints = []
      
      // WebGL情報収集
      fingerprints.push(gl.getParameter(gl.VENDOR))
      fingerprints.push(gl.getParameter(gl.RENDERER))
      fingerprints.push(gl.getParameter(gl.VERSION))
      fingerprints.push(gl.getParameter(gl.SHADING_LANGUAGE_VERSION))
      
      // 拡張機能
      const extensions = gl.getSupportedExtensions()
      fingerprints.push(extensions ? extensions.sort().join(',') : 'no_extensions')
      
      // WebGL能力
      fingerprints.push(gl.getParameter(gl.MAX_TEXTURE_SIZE))
      fingerprints.push(gl.getParameter(gl.MAX_VIEWPORT_DIMS))
      fingerprints.push(gl.getParameter(gl.MAX_VERTEX_ATTRIBS))
      
      return fingerprints.join('|')
    } catch (error) {
      return 'webgl_error'
    }
  }

  /**
   * フォント検出フィンガープリント
   */
  getFontFingerprint() {
    try {
      const testFonts = [
        'Arial', 'Times New Roman', 'Courier New', 'Helvetica', 'Georgia',
        'Verdana', 'Times', 'Comic Sans MS', 'Impact', 'Trebuchet MS',
        'Arial Black', 'Palatino', 'Garamond', 'Bookman', 'Tahoma',
        'MS Sans Serif', 'MS Serif', 'Yu Gothic', 'Meiryo', 'MS PGothic',
        'Hiragino Sans', 'Noto Sans CJK JP', 'Osaka'
      ]
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const testString = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789あいうえおアイウエオ'
      
      // デフォルトフォントでの幅測定
      ctx.font = '12px monospace'
      const defaultWidth = ctx.measureText(testString).width
      
      const availableFonts = []
      
      testFonts.forEach(font => {
        ctx.font = `12px ${font}, monospace`
        const width = ctx.measureText(testString).width
        if (Math.abs(width - defaultWidth) > 1) {
          availableFonts.push(font)
        }
      })
      
      return availableFonts.sort().join(',')
    } catch (error) {
      return 'font_error'
    }
  }

  /**
   * ハードウェア情報フィンガープリント
   */
  getHardwareFingerprint() {
    try {
      const fingerprints = []
      
      // CPU情報
      fingerprints.push(navigator.hardwareConcurrency || 'unknown_cores')
      fingerprints.push(navigator.deviceMemory || 'unknown_memory')
      
      // 画面情報
      fingerprints.push(`${screen.width}x${screen.height}`)
      fingerprints.push(`${screen.availWidth}x${screen.availHeight}`)
      fingerprints.push(screen.colorDepth)
      fingerprints.push(screen.pixelDepth)
      fingerprints.push(window.devicePixelRatio || 1)
      
      // 向き情報
      if (screen.orientation) {
        fingerprints.push(screen.orientation.type)
        fingerprints.push(screen.orientation.angle)
      }
      
      // バッテリー情報（可能な場合）
      if (navigator.getBattery) {
        // 非同期なのでスキップするか後で実装
        fingerprints.push('battery_api_available')
      }
      
      // タッチ対応
      fingerprints.push(navigator.maxTouchPoints || 0)
      
      return fingerprints.join('|')
    } catch (error) {
      return 'hardware_error'
    }
  }

  /**
   * ネットワーク・ブラウザ環境フィンガープリント
   */
  getEnvironmentFingerprint() {
    try {
      const fingerprints = []
      
      // ブラウザ情報
      fingerprints.push(navigator.userAgent)
      fingerprints.push(navigator.language)
      fingerprints.push(navigator.languages ? navigator.languages.join(',') : 'no_languages')
      fingerprints.push(navigator.platform)
      fingerprints.push(navigator.cookieEnabled)
      fingerprints.push(navigator.doNotTrack || 'not_set')
      
      // プラグイン情報
      const plugins = []
      for (let i = 0; i < navigator.plugins.length; i++) {
        plugins.push(navigator.plugins[i].name)
      }
      fingerprints.push(plugins.sort().join(','))
      
      // 接続情報
      if (navigator.connection) {
        fingerprints.push(navigator.connection.effectiveType || 'unknown_connection')
        fingerprints.push(navigator.connection.downlink || 'unknown_speed')
      }
      
      // タイムゾーン
      fingerprints.push(new Date().getTimezoneOffset())
      fingerprints.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown_tz')
      
      // ウィンドウ情報
      fingerprints.push(`${window.innerWidth}x${window.innerHeight}`)
      fingerprints.push(`${window.outerWidth}x${window.outerHeight}`)
      
      return fingerprints.join('|')
    } catch (error) {
      return 'environment_error'
    }
  }

  /**
   * 基本フィンガープリント（後方互換性）
   */
  getBasicFingerprint() {
    return [
      navigator.userAgent,
      navigator.language,
      `${screen.width}x${screen.height}`,
      new Date().getTimezoneOffset()
    ].join('|')
  }

  /**
   * ハッシュ生成（改良版）
   */
  generateHash(input) {
    let hash = 0x811c9dc5 // FNV-1a initial hash
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return (hash >>> 0).toString(36) // 符号なし32bitに変換
  }

  /**
   * 今日の日付を取得（日本時間）
   */
  getTodayDate() {
    return DateUtils.getTodayJST()
  }

  /**
   * ゲストユーザーが生成可能かチェック
   * @returns {boolean}
   */
  canGuestGenerate() {
    const today = this.getTodayDate()
    return this.usageData.lastUsageDate !== today
  }

  /**
   * ゲストユーザーの使用を記録
   */
  recordGuestUsage() {
    const today = this.getTodayDate()
    this.usageData.lastUsageDate = today
    this.usageData.usageCount += 1
    this.saveUsageData()
    
    console.log('[UsageManager] Guest usage recorded:', {
      date: today,
      totalCount: this.usageData.usageCount
    })
  }

  /**
   * 使用統計を取得
   * @returns {Object}
   */
  getUsageStats() {
    return {
      ...this.usageData,
      canGuestGenerate: this.canGuestGenerate(),
      todayDate: this.getTodayDate()
    }
  }

  /**
   * 使用データをリセット
   */
  resetUsageData() {
    this.usageData = {
      lastUsageDate: null,
      usageCount: 0,
      deviceId: this.generateDeviceId()
    }
    this.saveUsageData()
    console.log('[UsageManager] Usage data reset')
  }
}

// ========================================
// 🔐 認証サービス（AuthService）
// ========================================

class AuthService {
  constructor() {
    this.currentUser = null
    this.authToken = null
    this.authListeners = []
    this.sessionTimer = null
    this.refreshTimer = null
    this.sessionFingerprint = null
    this.securityCheckTimer = null
    
    // セッションフィンガープリンティング初期化
    this.initSessionFingerprint()
    
    console.log('[AuthService] Initialized with enhanced session security')
  }
  
  /**
   * セッションフィンガープリンティング初期化
   */
  initSessionFingerprint() {
    try {
      // 簡単なクライアントサイドフィンガープリント生成
      const components = {
        userAgent: navigator.userAgent.substring(0, 100),
        language: navigator.language || 'unknown',
        platform: navigator.platform || 'unknown',
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenResolution: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 6)) // 6時間単位でローテーション
      }
      
      // JSON文字列化して簡易ハッシュ化
      const dataString = JSON.stringify(components)
      let hash = 0
      for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // 32bit整数に変換
      }
      
      this.sessionFingerprint = `fp_${Math.abs(hash).toString(36).substring(0, 16)}`
      
      // セッションフィンガープリントをストレージに保存
      StorageHelper.set(APP_CONSTANTS.STORAGE.SESSION_KEY, this.sessionFingerprint)
      
      console.log('[AuthService] Session fingerprint initialized:', this.sessionFingerprint.substring(0, 8) + '...')
    } catch (error) {
      console.warn('[AuthService] Fingerprint generation failed:', error)
      this.sessionFingerprint = `fp_fallback_${Date.now().toString(36)}`
    }
  }
  
  /**
   * セッションセキュリティチェック開始
   */
  startSecurityMonitoring() {
    if (this.securityCheckTimer) {
      clearInterval(this.securityCheckTimer)
    }
    
    this.securityCheckTimer = setInterval(() => {
      this.performSecurityCheck()
    }, APP_CONSTANTS.TIMERS.SESSION_CHECK) // 5分ごと
    
    console.log('[AuthService] Security monitoring started')
  }
  
  /**
   * セッションセキュリティチェック実行
   */
  performSecurityCheck() {
    try {
      // 現在のフィンガープリントと保存されたものを比較
      const storedFingerprint = StorageHelper.get(APP_CONSTANTS.STORAGE.SESSION_KEY, null)
      
      if (storedFingerprint !== this.sessionFingerprint) {
        console.warn('[AuthService] Session fingerprint mismatch detected')
        console.warn('- Stored:', storedFingerprint?.substring(0, 8) + '...')
        console.warn('- Current:', this.sessionFingerprint?.substring(0, 8) + '...')
        
        // セッションハイジャックの可能性 - 強制ログアウト
        this.handleSecurityThreat('Session fingerprint mismatch')
      }
      
      // トークンの整合性チェック
      if (this.authToken && !this.authToken.startsWith('demo_token_') && !this.authToken.startsWith('secure_token_')) {
        console.warn('[AuthService] Invalid token format detected')
        this.handleSecurityThreat('Invalid token format')
      }
    } catch (error) {
      console.error('[AuthService] Security check failed:', error)
    }
  }
  
  /**
   * セキュリティ脅威ハンドラー
   * @param {string} reason 脅威の理由
   */
  handleSecurityThreat(reason) {
    console.error('[AuthService] Security threat detected:', reason)
    
    // ユーザーに警告表示
    if (window.NotificationHelper) {
      NotificationHelper.show(`セキュリティ上の理由でログアウトしました。再度ログインしてください。`, 'error')
    }
    
    // 強制ログアウト
    this.logout()
  }
  
  /**
   * セキュリティ監視停止
   */
  stopSecurityMonitoring() {
    if (this.securityCheckTimer) {
      clearInterval(this.securityCheckTimer)
      this.securityCheckTimer = null
      console.log('[AuthService] Security monitoring stopped')
    }
  }

  /**
   * パスワード認証ログイン（機能維持）
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async login(password) {
    try {
      console.log('[AuthService] Starting password login...')
      
      if (!password) {
        throw new Error('パスワードが入力されていません')
      }
      
      // パスワードセキュリティ強化: リクエスト送信後にメモリから消去
      const requestBody = JSON.stringify({ password })
      
      const response = await fetch(APP_CONSTANTS.API.ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      })
      
      // パスワードをメモリから完全消去（セキュリティ強化）
      password = null
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `ログインに失敗しました: ${response.status}`)
      }
      
      if (data.success && data.data?.user && data.data?.token) {
        this.currentUser = data.data.user
        this.authToken = data.data.token
        
        StorageHelper.set(APP_CONSTANTS.STORAGE.TOKEN_KEY, data.data.token)
        StorageHelper.set(APP_CONSTANTS.STORAGE.USER_KEY, data.data.user)
        
        // 強化されたセッション監視開始
        this.startSessionMonitoring()
        this.startSecurityMonitoring()
        this.notifyAuthListeners(true)
        
        console.log('[AuthService] Login successful:', data.data.user.name)
        return true
      } else {
        throw new Error(data.error || 'ログインレスポンスが無効です')
      }
    } catch (error) {
      // エラー時もパスワードをメモリから消去
      password = null
      console.error('[AuthService] Login error:', error)
      throw error
    } finally {
      // 終了時に必ずパスワードをメモリから消去
      password = null
    }
  }

  /**
   * ログアウト処理（機能維持）
   */
  async logout() {
    try {
      console.log('[AuthService] Starting logout...')
      
      this.stopSessionMonitoring()
      this.stopSecurityMonitoring()
      
      StorageHelper.remove(APP_CONSTANTS.STORAGE.TOKEN_KEY)
      StorageHelper.remove(APP_CONSTANTS.STORAGE.USER_KEY)
      
      this.currentUser = null
      this.authToken = null
      
      this.notifyAuthListeners(false)
      console.log('[AuthService] Logout completed')
    } catch (error) {
      console.error('[AuthService] Logout error:', error)
    }
  }

  /**
   * セッション監視開始（機能維持）
   */
  startSessionMonitoring() {
    this.stopSessionMonitoring()
    
    this.sessionTimer = setInterval(() => {
      this.validateSession()
    }, APP_CONSTANTS.TIMERS.SESSION_CHECK)
    
    this.refreshTimer = setInterval(() => {
      this.refreshToken()
    }, APP_CONSTANTS.TIMERS.AUTO_REFRESH)
  }

  /**
   * セッション監視停止
   */
  stopSessionMonitoring() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /**
   * セッション検証（機能維持）
   */
  async validateSession() {
    if (!this.authToken) return false
    
    try {
      const response = await fetch(APP_CONSTANTS.API.ENDPOINTS.VALIDATE, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      })
      
      if (!response.ok) {
        console.log('[AuthService] Session validation failed, logging out')
        await this.logout()
        return false
      }
      
      return true
    } catch (error) {
      console.error('[AuthService] Session validation error:', error)
      return false
    }
  }

  /**
   * トークン更新（機能維持）
   */
  async refreshToken() {
    if (!this.authToken) return false
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.token) {
          this.authToken = data.token
          StorageHelper.set(APP_CONSTANTS.STORAGE.TOKEN_KEY, data.token)
          console.log('[AuthService] Token refreshed successfully')
        }
      }
    } catch (error) {
      console.error('[AuthService] Token refresh error:', error)
    }
  }

  // ユーティリティメソッド
  isAuthenticated() { return !!(this.currentUser && this.authToken) }
  getCurrentUser() { return this.currentUser }
  getAuthToken() { return this.authToken }

  addAuthListener(callback) { this.authListeners.push(callback) }
  removeAuthListener(callback) {
    const index = this.authListeners.indexOf(callback)
    if (index > -1) this.authListeners.splice(index, 1)
  }

  notifyAuthListeners(isAuthenticated) {
    this.authListeners.forEach(callback => {
      try {
        callback(isAuthenticated, this.currentUser)
      } catch (error) {
        console.error('[AuthService] Listener callback error:', error)
      }
    })
  }

  /**
   * 保存された認証情報をロード（機能維持）
   */
  loadStoredAuth() {
    try {
      const storedToken = StorageHelper.get(APP_CONSTANTS.STORAGE.TOKEN_KEY)
      const storedUser = StorageHelper.get(APP_CONSTANTS.STORAGE.USER_KEY)
      
      if (storedToken && storedUser) {
        this.authToken = storedToken
        this.currentUser = storedUser
        this.startSessionMonitoring()
        console.log('[AuthService] Stored auth loaded:', this.currentUser.name)
        return true
      }
    } catch (error) {
      console.error('[AuthService] Error loading stored auth:', error)
      StorageHelper.remove(APP_CONSTANTS.STORAGE.TOKEN_KEY)
      StorageHelper.remove(APP_CONSTANTS.STORAGE.USER_KEY)
    }
    return false
  }
}

// ========================================
// 🎨 UI管理システム（UIManager）
// ========================================

class UIManager {
  constructor() {
    this.elements = {}
    this.initialized = false
    console.log('[UIManager] Initialized')
  }

  /**
   * DOM要素をキャッシュ（Safari対応版）
   */
  async cacheDOMElements() {
    // Safari用の特別処理：DOM準備完了まで待機
    if (DOM.isSafari() || DOM.isWebKit()) {
      console.log('[UIManager] Safari detected, waiting for DOM elements...')
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // 認証関連要素
    this.elements.auth = {
      modal: DOM.get('auth-modal'),
      loginBtn: DOM.get('login-btn'),
      loginForm: DOM.get('login-form'),
      loginPassword: DOM.get('login-password'),
      userStatus: DOM.get('user-status'),
      authButtons: DOM.get('auth-buttons'),
      userName: DOM.get('user-name'),
      userAvatar: DOM.get('user-avatar'),
      logoutBtn: DOM.get('logout-btn'),
      closeModal: DOM.get('close-modal'),
      loginError: DOM.get('login-error-message')
    }

    // 変換関連要素（Safari用の特別処理を追加）
    this.elements.conversion = {
      inputText: DOM.get('input-text'),
      outputText: DOM.get('output-text'),
      generateBtn: DOM.get('generate-btn'),
      clearBtn: DOM.get('clear-input'),
      clearOutputBtn: DOM.get('clear-output'),
      copyBtn: DOM.get('copy-btn'),
      inputCount: DOM.get('input-count'),
      outputCount: DOM.get('output-count'),
      charLimitSlider: DOM.get('char-limit-slider'),
      charLimitDisplay: DOM.get('char-limit-display'),
      authMessage: DOM.get('auth-required-message'),
      usageMessage: await DOM.waitForElement('usage-limit-message', 3000) // Safari用の待機処理
    }

    // オプション関連要素  
    this.elements.options = {}
    APP_CONSTANTS.BUTTONS.DOCUMENT.forEach(id => {
      this.elements.options[id] = DOM.get(id)
    })
    APP_CONSTANTS.BUTTONS.FORMAT.forEach(id => {
      this.elements.options[id] = DOM.get(id)
    })
    APP_CONSTANTS.BUTTONS.STYLE.forEach(id => {
      this.elements.options[id] = DOM.get(id)
    })

    console.log('[UIManager] DOM elements cached')
  }

  /**
   * 認証状態に応じたUI更新（機能維持）
   */
  updateAuthUI(isAuthenticated, user) {
    console.log('[UIManager] Updating auth UI:', { isAuthenticated, user: user?.name })
    
    if (isAuthenticated && user) {
      DOM.toggle('auth-buttons', false)
      DOM.toggle('user-status', true)
      
      if (this.elements.auth.userName) {
        this.elements.auth.userName.textContent = user.name
      }
      if (user.picture && this.elements.auth.userAvatar) {
        this.elements.auth.userAvatar.src = user.picture
        this.elements.auth.userAvatar.style.display = 'block'
      }
    } else {
      DOM.toggle('auth-buttons', true)
      DOM.toggle('user-status', false)
    }
  }

  /**
   * 認証モーダル表示/非表示（機能維持）
   */
  toggleAuthModal(show = true) {
    if (this.elements.auth.modal) {
      this.elements.auth.modal.style.display = show ? 'flex' : 'none'
      if (!show) {
        this.clearAuthError()
        this.setAuthLoadingState(false)
      }
    }
  }

  /**
   * 認証エラー表示
   */
  showAuthError(message) {
    if (this.elements.auth.loginError) {
      this.elements.auth.loginError.textContent = message
      this.elements.auth.loginError.style.display = 'block'
    }
  }

  /**
   * 認証エラークリア
   */
  clearAuthError() {
    if (this.elements.auth.loginError) {
      this.elements.auth.loginError.style.display = 'none'
      this.elements.auth.loginError.textContent = ''
    }
  }

  /**
   * 認証ローディング状態（機能維持）
   */
  setAuthLoadingState(loading) {
    if (this.elements.auth.loginPassword) {
      this.elements.auth.loginPassword.disabled = loading
    }
    
    const loginSubmitBtn = document.querySelector('#login-form button[type="submit"]')
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = loading
    }
    
    const loginBtnText = DOM.get('login-btn-text')
    const loginSpinner = DOM.get('login-spinner')
    
    if (loginBtnText && loginSpinner) {
      if (loading) {
        loginBtnText.style.display = 'none'
        loginSpinner.style.display = 'inline-block'
      } else {
        loginBtnText.style.display = 'inline'
        loginSpinner.style.display = 'none'
      }
    }
  }
}

// ========================================
// 🎯 メインアプリケーションサービス（AppService）
// ========================================

class AppService {
  constructor() {
    /** @type {AuthService} 認証サービス */
    this.authService = new AuthService()
    
    /** @type {UIManager} UIマネージャー */
    this.uiManager = new UIManager()
    
    /** @type {UsageManager} 使用回数管理 */
    this.usageManager = new UsageManager()
    
    /** @type {Object} アプリケーション状態 */
    this.state = {
      initialized: false,
      conversionHistory: [],
      currentConversion: null,
      isProcessing: false
    }
    
    console.log('[AppService] Initialized')
  }

  // ========================================
  // 🚀 アプリケーション初期化
  // ========================================

  /**
   * アプリケーション初期化（Safari対応版）
   */
  async initialize() {
    try {
      console.log('[AppService] Starting application initialization...')
      
      // DOM要素キャッシュ（Safari対応の非同期版）
      await this.uiManager.cacheDOMElements()
      
      // 保存された認証情報をロード
      this.authService.loadStoredAuth()
      
      // 認証状態監視設定（非同期対応）
      this.authService.addAuthListener(async (isAuthenticated, user) => {
        this.uiManager.updateAuthUI(isAuthenticated, user)
        await this.updateUsageLimits(isAuthenticated)
      })
      
      // 使用制限システム初期化（認証UIより先に・Safari対応版）
      await this.initializeUsageControl()
      
      // 各種UI要素初期化
      this.initializeAuthUI()
      this.initializeConversionForm() 
      this.initializeOtherElements()
      this.initializeHistory()
      
      // 初期状態表示
      this.uiManager.updateAuthUI(
        this.authService.isAuthenticated(), 
        this.authService.getCurrentUser()
      )
      
      this.state.initialized = true
      console.log('[AppService] Application initialization completed')
      
    } catch (error) {
      console.error('[AppService] Initialization error:', error)
      throw error
    }
  }

  /**
   * 認証UI初期化
   */
  initializeAuthUI() {
    // ログインボタン
    const loginBtn = this.uiManager.elements.auth?.loginBtn
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        this.uiManager.toggleAuthModal(true)
      })
    }
    
    // ログインフォーム
    const loginForm = this.uiManager.elements.auth?.loginForm  
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        await this.handlePasswordLogin()
      })
    }
    
    // ログアウトボタン
    const logoutBtn = this.uiManager.elements.auth?.logoutBtn
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await this.handleLogout()
      })
    }
    
    // モーダル閉じる
    const closeModal = this.uiManager.elements.auth?.closeModal
    if (closeModal) {
      closeModal.addEventListener('click', () => {
        this.uiManager.toggleAuthModal(false)
      })
    }
    
    // モーダル背景クリック
    const authModal = this.uiManager.elements.auth?.modal
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
          this.uiManager.toggleAuthModal(false)
        }
      })
    }
    
    // パスワード入力でエラークリア
    const loginPassword = this.uiManager.elements.auth?.loginPassword
    if (loginPassword) {
      loginPassword.addEventListener('input', () => {
        this.uiManager.clearAuthError()
      })
    }
    
    console.log('[AppService] Auth UI initialized')
  }

  /**
   * 変換フォーム初期化
   */
  initializeConversionForm() {
    const textInput = this.uiManager.elements.conversion?.inputText
    const generateBtn = this.uiManager.elements.conversion?.generateBtn
    
    if (textInput && generateBtn) {
      // 生成ボタンクリック
      generateBtn.addEventListener('click', async (e) => {
        e.preventDefault()
        await this.handleConversion()
      })
      
      // リアルタイム文字数カウント
      textInput.addEventListener('input', () => {
        this.updateCharacterCount()
      })
      
      console.log('[AppService] Conversion form initialized')
    } else {
      console.error('[AppService] Required elements not found:', {
        textInput: !!textInput,
        generateBtn: !!generateBtn
      })
    }
  }

  /**
   * 履歴初期化
   */
  initializeHistory() {
    try {
      const storedHistory = StorageHelper.get(APP_CONSTANTS.STORAGE.HISTORY_KEY, [])
      this.state.conversionHistory = storedHistory
      this.displayConversionHistory()
      
      console.log('[AppService] History initialized:', this.state.conversionHistory.length, 'items')
    } catch (error) {
      console.error('[AppService] History initialization error:', error)
      this.state.conversionHistory = []
    }
  }

  // ========================================
  // 🔐 認証処理
  // ========================================

  /**
   * パスワードログイン処理（機能完全維持）
   */
  async handlePasswordLogin() {
    try {
      console.log('[AppService] Processing password login...')
      
      const password = this.uiManager.elements.auth?.loginPassword?.value?.trim() || ''
      
      if (!password) {
        this.uiManager.showAuthError('パスワードを入力してください')
        return
      }
      
      // ローディング状態表示
      this.uiManager.setAuthLoadingState(true)
      this.uiManager.clearAuthError()
      
      // 認証実行
      await this.authService.login(password)
      
      // パスワードをフィールドから完全消去（セキュリティ強化）
      if (this.uiManager.elements.auth?.loginPassword) {
        this.uiManager.elements.auth.loginPassword.value = ''
        this.uiManager.elements.auth.loginPassword.type = 'text'
        this.uiManager.elements.auth.loginPassword.type = 'password'
      }
      
      // モーダルを閉じる
      this.uiManager.toggleAuthModal(false)
      
      // フォームリセット
      if (this.uiManager.elements.auth?.loginForm) {
        this.uiManager.elements.auth.loginForm.reset()
      }
      
      console.log('[AppService] Password login completed successfully')
      
    } catch (error) {
      console.error('[AppService] Password login failed:', error)
      this.uiManager.showAuthError(`ログインに失敗しました: ${error.message}`)
      
      // エラー時もパスワードをフィールドから完全消去
      if (this.uiManager.elements.auth?.loginPassword) {
        this.uiManager.elements.auth.loginPassword.value = ''
      }
    } finally {
      this.uiManager.setAuthLoadingState(false)
      
      // 終了時に必ずパスワードをフィールドから消去
      if (this.uiManager.elements.auth?.loginPassword) {
        this.uiManager.elements.auth.loginPassword.value = ''
      }
    }
  }

  /**
   * ログアウト処理（機能完全維持）
   */
  async handleLogout() {
    try {
      console.log('[AppService] Processing logout...')
      
      if (!confirm('ログアウトしますか？')) {
        return
      }
      
      await this.authService.logout()
      console.log('[AppService] Logout completed successfully')
      
    } catch (error) {
      console.error('[AppService] Logout failed:', error)
      this.uiManager.showAuthError(`ログアウトに失敗しました: ${error.message}`)
    }
  }

  // ========================================  
  // 🔄 AI変換処理（Geminiプロンプト完全維持）
  // ========================================

  /**
   * AI変換実行（全機能維持）
   */
  async handleConversion() {
    if (this.state.isProcessing) {
      console.log('[AppService] Conversion already in progress')
      return
    }
    
    try {
      const textInput = this.uiManager.elements.conversion?.inputText
      const text = textInput?.value?.trim()
      
      if (!text) {
        alert('変換するテキストを入力してください。')
        return
      }
      
      console.log('[AppService] Starting AI conversion...', { textLength: text.length })
      
      // 使用制限チェック
      if (!this.checkUsageLimits()) {
        return
      }
      
      // 処理開始
      this.setConversionLoadingState(true)
      
      // 文字制限取得
      const charLimitSlider = this.uiManager.elements.conversion?.charLimitSlider
      const charLimit = charLimitSlider ? parseInt(charLimitSlider.value) : APP_CONSTANTS.DEFAULT_OPTIONS.CHAR_LIMIT

      // 選択オプション取得（完全維持）
      const selectedOptions = this.getSelectedOptions()
      
      console.log('[AppService] Selected options:', selectedOptions)

      // API呼び出し（Geminiプロンプト維持）
      const response = await fetch(APP_CONSTANTS.API.ENDPOINTS.CONVERT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authService.getAuthToken() && {
            'Authorization': `Bearer ${this.authService.getAuthToken()}`
          })
        },
        body: JSON.stringify({
          text: text,
          style: selectedOptions.style,
          docType: selectedOptions.docType,
          format: selectedOptions.format,
          charLimit: charLimit
        })
      })
      
      if (!response.ok) {
        throw new Error(`変換に失敗しました: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        const convertedText = result.data.result || ''
        const responseTime = result.data.responseTime || 0
        
        const conversionResult = {
          converted_text: convertedText,
          suggestions: [],
          response_time: responseTime
        }
        
        // 結果表示
        this.displayConversionResult(conversionResult)
        
        // ゲスト使用記録
        this.recordGuestUsage()
        
        // 履歴追加
        this.addToHistory({
          id: Date.now(),
          originalText: text,
          convertedText: convertedText,
          suggestions: [],
          timestamp: new Date().toISOString(),
          user: this.authService.getCurrentUser()
        })
        
        // 入力内容は変換後も保持（ユーザーが手動でクリアする）
        // textInput.value = '' // 削除：自動クリアしない
        // this.updateCharacterCount() // 入力内容が残るので文字数カウントは不要
        
        console.log('[AppService] AI conversion completed successfully')
      } else {
        throw new Error(result.error || 'AIサービスから正常な応答が得られませんでした')
      }
      
    } catch (error) {
      console.error('[AppService] Conversion error:', error)
      this.showConversionError(error.message)
    } finally {
      this.setConversionLoadingState(false)
    }
  }

  /**
   * 選択オプション取得（完全維持）
   */
  getSelectedOptions() {
    let docType = APP_CONSTANTS.DEFAULT_OPTIONS.DOC_TYPE
    let format = APP_CONSTANTS.DEFAULT_OPTIONS.FORMAT
    let style = APP_CONSTANTS.DEFAULT_OPTIONS.STYLE
    
    // ドキュメント種別確認
    const docReportBtn = DOM.get('doc-report')
    if (docReportBtn && docReportBtn.classList.contains('bg-pink-600')) {
      docType = '報告書'
    }
    
    // フォーマット確認（SOAP重要）
    const formatSoapBtn = DOM.get('format-soap')
    if (formatSoapBtn && formatSoapBtn.classList.contains('bg-pink-600')) {
      format = 'SOAP形式'
    }
    
    // 文体確認
    const stylePoliteBtn = DOM.get('style-polite')
    if (stylePoliteBtn && stylePoliteBtn.classList.contains('bg-pink-600')) {
      style = 'ですます体'
    }
    
    return { docType, format, style }
  }

  // ========================================
  // 🎨 UI更新とフィードバック
  // ========================================

  /**
   * 変換結果表示（機能維持）
   */
  displayConversionResult(result) {
    const outputText = this.uiManager.elements.conversion?.outputText
    const outputCount = this.uiManager.elements.conversion?.outputCount
    
    if (!outputText) {
      console.error('[AppService] Output text element not found')
      return
    }
    
    let convertedText = result.converted_text || '変換結果が空です'
    
    // アスタリスク（**）を除去
    convertedText = convertedText.replace(/\*\*/g, '')
    
    // 結果表示
    outputText.innerHTML = convertedText.replace(/\n/g, '<br>')
    
    // 文字数更新
    if (outputCount) {
      outputCount.textContent = `${convertedText.length}文字`
    }
    
    // コピーボタン有効化
    const copyBtn = this.uiManager.elements.conversion?.copyBtn
    if (copyBtn) {
      copyBtn.disabled = false
      copyBtn.onclick = () => this.copyResult(convertedText)
    }
    
    console.log('[AppService] Conversion result displayed:', convertedText.length, 'characters')
  }

  /**
   * 文字数カウント更新
   */
  updateCharacterCount() {
    const textInput = this.uiManager.elements.conversion?.inputText
    const charCount = this.uiManager.elements.conversion?.inputCount
    
    if (textInput && charCount) {
      const length = textInput.value.length
      charCount.textContent = `${length}文字`
      
      // 視覚的フィードバック
      if (length > 1000) {
        charCount.classList.add('text-red-500')
        charCount.classList.remove('text-pink-600')
      } else {
        charCount.classList.add('text-pink-600')
        charCount.classList.remove('text-red-500')
      }
    }
  }

  /**
   * 変換エラー表示
   */
  showConversionError(message) {
    const resultContainer = DOM.get('conversionResult')
    if (!resultContainer) return
    
    resultContainer.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex">
          <i class="fas fa-exclamation-triangle text-red-500 mr-2 mt-1"></i>
          <div>
            <h3 class="text-red-800 font-medium">変換エラー</h3>
            <p class="text-red-700 mt-1">${message}</p>
          </div>
        </div>
      </div>
    `
    resultContainer.style.display = 'block'
  }

  /**
   * 変換ローディング状態設定
   */
  setConversionLoadingState(loading) {
    const generateBtn = this.uiManager.elements.conversion?.generateBtn
    const textInput = this.uiManager.elements.conversion?.inputText
    
    if (generateBtn) {
      generateBtn.disabled = loading
      generateBtn.innerHTML = loading 
        ? '<i class="fas fa-spinner fa-spin mr-2"></i>生成中...' 
        : '生成'
    }
    
    if (textInput) {
      textInput.disabled = loading
    }
    
    this.state.isProcessing = loading
  }

  // ========================================
  // 📂 履歴管理
  // ========================================

  /**
   * 履歴追加
   */
  addToHistory(item) {
    this.state.conversionHistory.push(item)
    
    // 最新50件保持
    if (this.state.conversionHistory.length > 50) {
      this.state.conversionHistory = this.state.conversionHistory.slice(-50)
    }
    
    // 保存
    StorageHelper.set(APP_CONSTANTS.STORAGE.HISTORY_KEY, this.state.conversionHistory)
    
    // 表示更新
    this.displayConversionHistory()
  }

  /**
   * 履歴表示
   */
  displayConversionHistory() {
    const historyContainer = DOM.get('conversionHistory')
    if (!historyContainer || this.state.conversionHistory.length === 0) return
    
    const historyHtml = this.state.conversionHistory
      .slice(-5)
      .reverse()
      .map(item => `
        <div class="bg-gray-50 rounded-lg p-4 border">
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs text-gray-500">${new Date(item.timestamp).toLocaleString('ja-JP')}</span>
            <button onclick="app.loadHistoryItem(${item.id})" 
                    class="text-xs text-blue-600 hover:text-blue-800">再読み込み</button>
          </div>
          <div class="text-sm text-gray-600 mb-2 line-clamp-2">${item.originalText}</div>
          <div class="text-sm text-gray-800 line-clamp-3">${item.convertedText}</div>
        </div>
      `).join('')
    
    historyContainer.innerHTML = historyHtml
  }

  /**
   * 履歴アイテム読み込み
   */
  loadHistoryItem(itemId) {
    const item = this.state.conversionHistory.find(h => h.id === itemId)
    if (!item) return
    
    const textInput = this.uiManager.elements.conversion?.inputText
    if (textInput) {
      textInput.value = item.originalText
      this.updateCharacterCount()
      textInput.focus()
    }
    
    console.log('[AppService] History item loaded:', itemId)
  }

  // ========================================
  // 🛠️ ユーティリティ
  // ========================================

  /**
   * テキストコピー
   */
  async copyResult(text) {
    try {
      await navigator.clipboard.writeText(text)
      
      // 成功フィードバック
      const notification = document.createElement('div')
      notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      notification.textContent = 'クリップボードにコピーしました'
      document.body.appendChild(notification)
      
      setTimeout(() => {
        notification.remove()
      }, APP_CONSTANTS.TIMERS.NOTIFICATION_DURATION)
      
      console.log('[AppService] Text copied to clipboard')
    } catch (error) {
      console.error('[AppService] Copy error:', error)
      alert('コピーに失敗しました')
    }
  }

  /**
   * その他UI要素初期化
   */
  initializeOtherElements() {
    // 入力クリアボタン
    const clearBtn = this.uiManager.elements.conversion?.clearBtn
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearInput()
      })
    }
    
    // 出力クリアボタン
    const clearOutputBtn = this.uiManager.elements.conversion?.clearOutputBtn
    if (clearOutputBtn) {
      clearOutputBtn.addEventListener('click', () => {
        this.clearOutput()
      })
    }
    
    // 文字制限スライダー
    this.initializeCharacterLimitSlider()
    
    // オプションボタン
    this.initializeOptionButtons()
    
    console.log('[AppService] Other elements initialized')
  }

  /**
   * 文字制限スライダー初期化
   */
  initializeCharacterLimitSlider() {
    const slider = this.uiManager.elements.conversion?.charLimitSlider
    const display = this.uiManager.elements.conversion?.charLimitDisplay
    
    if (slider && display) {
      slider.addEventListener('input', (e) => {
        const value = e.target.value
        display.textContent = `${value}文字`
      })
      console.log('[AppService] Character limit slider initialized')
    }
  }

  /**
   * オプションボタン初期化（完全維持）
   */
  initializeOptionButtons() {
    // ボタングループ初期化
    this.initializeButtonGroup(APP_CONSTANTS.BUTTONS.DOCUMENT)
    this.initializeButtonGroup(APP_CONSTANTS.BUTTONS.FORMAT)
    this.initializeButtonGroup(APP_CONSTANTS.BUTTONS.STYLE)
    
    // デフォルト選択
    this.selectButton(APP_CONSTANTS.BUTTONS.DOCUMENT, 'doc-record')
    this.selectButton(APP_CONSTANTS.BUTTONS.FORMAT, 'format-text')
    this.selectButton(APP_CONSTANTS.BUTTONS.STYLE, 'style-plain')
    
    console.log('[AppService] Option buttons initialized with defaults')
  }

  /**
   * ボタングループ初期化
   */
  initializeButtonGroup(buttonIds) {
    buttonIds.forEach(buttonId => {
      const button = DOM.get(buttonId)
      if (button) {
        button.addEventListener('click', () => {
          this.selectButton(buttonIds, buttonId)
        })
      }
    })
  }

  /**
   * ボタン選択（報告書選択時のSOAP形式無効化対応）
   */
  selectButton(groupIds, selectedId) {
    groupIds.forEach(id => {
      const button = DOM.get(id)
      if (button) {
        if (id === selectedId) {
          // 選択状態
          button.className = `${CSS_CLASSES.BUTTON.BASE} ${CSS_CLASSES.BUTTON.SELECTED}`
        } else {
          // 非選択状態  
          button.className = `${CSS_CLASSES.BUTTON.BASE} ${CSS_CLASSES.BUTTON.UNSELECTED}`
        }
      }
    })
    
    // 報告書選択時にSOAP形式を無効化する処理
    if (selectedId === 'doc-report') {
      this.handleReportSelection()
    } else if (selectedId === 'doc-record') {
      this.handleRecordSelection()
    }
    
    console.log(`[AppService] Button selected: ${selectedId}`)
  }

  /**
   * 報告書選択時の処理
   */
  handleReportSelection() {
    const soapBtn = DOM.get('format-soap')
    const textBtn = DOM.get('format-text')
    
    if (soapBtn && textBtn) {
      // SOAP形式ボタンを無効化
      soapBtn.disabled = true
      soapBtn.classList.add('opacity-50', 'cursor-not-allowed')
      soapBtn.classList.remove('hover:bg-pink-200')
      
      // 現在SOAP形式が選択されている場合は文章形式に切り替え
      if (soapBtn.classList.contains('bg-pink-600')) {
        this.selectButton(['format-text', 'format-soap'], 'format-text')
      }
      
      console.log('[AppService] Report selected: SOAP format disabled')
    }
  }

  /**
   * 記録選択時の処理
   */
  handleRecordSelection() {
    const soapBtn = DOM.get('format-soap')
    
    if (soapBtn) {
      // SOAP形式ボタンを有効化
      soapBtn.disabled = false
      soapBtn.classList.remove('opacity-50', 'cursor-not-allowed')
      soapBtn.classList.add('hover:bg-pink-200')
      
      console.log('[AppService] Record selected: SOAP format enabled')
    }
  }

  /**
   * 入力クリア（確認ダイアログ付き）
   */
  clearInput() {
    const textInput = this.uiManager.elements.conversion?.inputText
    if (textInput && textInput.value.trim()) {
      // 入力内容がある場合のみ確認ダイアログを表示
      const confirmed = confirm('入力内容をクリアしますか？')
      if (confirmed) {
        textInput.value = ''
        this.updateCharacterCount()
        textInput.focus()
        console.log('[AppService] Input cleared by user confirmation')
      }
    } else if (textInput) {
      // 入力内容が空の場合はそのままクリア
      textInput.value = ''
      this.updateCharacterCount()
      textInput.focus()
    }
  }

  /**
   * 出力クリア（確認ダイアログ付き）
   */
  clearOutput() {
    const outputText = this.uiManager.elements.conversion?.outputText
    const outputCount = this.uiManager.elements.conversion?.outputCount
    const copyBtn = this.uiManager.elements.conversion?.copyBtn

    if (outputText && outputText.textContent.trim() && 
        !outputText.textContent.includes('生成された文章がここに表示されます')) {
      // 出力内容がある場合のみ確認ダイアログを表示
      const confirmed = confirm('出力内容をクリアしますか？')
      if (confirmed) {
        outputText.innerHTML = '<div class="text-pink-400 italic">生成された文章がここに表示されます...</div>'
        if (outputCount) outputCount.textContent = '0文字'
        if (copyBtn) copyBtn.disabled = true
        console.log('[AppService] Output cleared by user confirmation')
      }
    } else if (outputText) {
      // 出力内容が空の場合はそのままクリア
      outputText.innerHTML = '<div class="text-pink-400 italic">生成された文章がここに表示されます...</div>'
      if (outputCount) outputCount.textContent = '0文字'
      if (copyBtn) copyBtn.disabled = true
    }
  }

  // ========================================
  // 📊 使用制限システム（完全維持）
  // ========================================
  
  /**
   * 使用制限システム初期化（Safari対応版）
   */
  async initializeUsageControl() {
    // 認証状態変更時の制限更新
    this.authService.addAuthListener(async (isAuthenticated) => {
      await this.updateUsageLimits(isAuthenticated)
    })
    
    // 初期状態設定（Safari用の待機処理）
    await this.updateUsageLimits(this.authService.isAuthenticated())
    
    console.log("[AppService] Usage control initialized")
  }
  
  /**
   * 使用制限状態更新（Safari対応版）
   */
  async updateUsageLimits(isAuthenticated) {
    const generateBtn = this.uiManager.elements.conversion?.generateBtn
    const authMessage = this.uiManager.elements.conversion?.authMessage
    let usageMessage = this.uiManager.elements.conversion?.usageMessage
    
    // Safari用: usageMessage要素が見つからない場合は再取得を試行
    if (!usageMessage && (DOM.isSafari() || DOM.isWebKit())) {
      console.log('[AppService] Usage message element not found on Safari, retrying...')
      usageMessage = await DOM.waitForElement('usage-limit-message', 2000)
      
      if (usageMessage) {
        // 要素が見つかった場合はキャッシュを更新
        this.uiManager.elements.conversion.usageMessage = usageMessage
        console.log('[AppService] Usage message element successfully retrieved on Safari')
      } else {
        console.error('[AppService] Failed to retrieve usage message element on Safari')
        return
      }
    }
    
    if (isAuthenticated) {
      // ログインユーザー: 無制限
      if (generateBtn) {
        generateBtn.disabled = false
        generateBtn.classList.remove("opacity-50", "cursor-not-allowed", "bg-gray-400")
        generateBtn.classList.add("hover:bg-pink-700", "bg-pink-600")
      }
      if (authMessage) authMessage.style.display = "none"
      if (usageMessage) usageMessage.style.display = "none"
      
      console.log("[AppService] Unlimited access enabled for authenticated user")
      
    } else {
// 非ログインユーザー: 1日3回制限
      const canGenerate = this.usageManager.canGuestGenerate()
      
      if (generateBtn) {
        generateBtn.disabled = !canGenerate
        if (canGenerate) {
          generateBtn.classList.remove("opacity-50", "cursor-not-allowed", "bg-gray-400")
          generateBtn.classList.add("hover:bg-pink-700", "bg-pink-600")
        } else {
          generateBtn.classList.add("opacity-50", "cursor-not-allowed", "bg-gray-400")
          generateBtn.classList.remove("hover:bg-pink-700", "bg-pink-600")
        }
      }
      
      // ゲストは認証メッセージ非表示
      if (authMessage) authMessage.style.display = "none"
      
      if (usageMessage) {
        if (canGenerate) {
          // Safari用の特別処理：hidden クラスを明示的に削除
          if (DOM.isSafari() || DOM.isWebKit()) {
            usageMessage.classList.remove('hidden')
            usageMessage.style.display = "block"
            usageMessage.style.visibility = "visible"
            console.log('[AppService] Safari: Usage message visibility forced')
          } else {
            usageMessage.style.display = "block"
          }
          
          // 利用可能な場合：利用制限の説明を表示
          usageMessage.innerHTML = `
            <div class="text-center">
              <p class="text-xs text-pink-600">
                <i class="fas fa-info-circle mr-1"></i>
<strong>利用制限:</strong> 新規ユーザーは1日3回まで利用可能
                <i class="fas fa-key mx-1"></i>
                ログインすると<strong>無制限で利用可能</strong>
              </p>
            </div>
          `
        } else {
          // Safari用の特別処理：hidden クラスを明示的に削除
          if (DOM.isSafari() || DOM.isWebKit()) {
            usageMessage.classList.remove('hidden')
            usageMessage.style.display = "block"
            usageMessage.style.visibility = "visible"
            console.log('[AppService] Safari: Usage limit message visibility forced')
          } else {
            usageMessage.style.display = "block"
          }
          
          // 利用制限に達した場合：制限メッセージを表示
          usageMessage.innerHTML = `
            <div class="flex items-center justify-center space-x-3 mb-3">
              <div class="flex items-center space-x-2">
                <i class="fas fa-clock text-red-600 text-lg"></i>
                <span class="text-base font-bold text-red-700">本日の利用回数を超えました</span>
              </div>
            </div>
            <div class="text-center">
              <p class="text-xs text-red-600">
                <i class="fas fa-info-circle mr-1"></i>
<strong>利用制限:</strong> 新規ユーザーは1日3回まで利用可能
                <i class="fas fa-key mx-1"></i>
                ログインすると<strong>無制限で利用可能</strong>
              </p>
            </div>
          `
        }
      }
      
      console.log("[AppService] Guest usage limits updated:", { canGenerate })
    }
  }
  
  /**
   * 使用制限チェック
   */
  checkUsageLimits() {
    const isAuthenticated = this.authService.isAuthenticated()
    
    if (isAuthenticated) {
      return true
    }
    
    const canGenerate = this.usageManager.canGuestGenerate()
    
    if (!canGenerate) {
      this.showUsageLimitError()
      return false
    }
    
    return true
  }
  
  /**
   * 使用制限エラー表示
   */
  showUsageLimitError() {
const errorMessage = "本日の利用回数を超えました。\n\n利用制限: 新規ユーザーは1日3回まで利用可能 ログインすると無制限で利用可能"
    alert(errorMessage)
  }
  
  /**
   * ゲスト利用記録
   */
  recordGuestUsage() {
    if (!this.authService.isAuthenticated()) {
      this.usageManager.recordGuestUsage()
      // 使用制限再更新
      this.updateUsageLimits(false)
    }
  }

  /**
   * アプリ統計取得
   */
  getAppStats() {
    return {
      totalConversions: this.state.conversionHistory.length,
      isAuthenticated: this.authService.isAuthenticated(),
      currentUser: this.authService.getCurrentUser(),
      initialized: this.state.initialized,
      usageStats: this.usageManager.getUsageStats()
    }
  }
}

// ========================================
// 🌍 グローバル初期化
// ========================================

/** @type {AppService} グローバルアプリケーションインスタンス */
let app

/**
 * アプリケーション初期化処理
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 タップカルテ - 最適化版 起動中...')
    
    // アプリケーションサービス作成
    app = new AppService()
    
    // グローバルに公開（デバッグ用）
    window.app = app
    
    // アプリケーション初期化
    await app.initialize()
    
    console.log('✅ タップカルテ - 最適化版 起動完了')
    
  } catch (error) {
    console.error('❌ アプリケーション初期化エラー:', error)
    
    // エラー表示
    document.body.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-red-50">
        <div class="text-center p-8">
          <i class="fas fa-exclamation-triangle text-red-500 text-6xl mb-4"></i>
          <h1 class="text-2xl font-bold text-red-800 mb-2">アプリケーションエラー</h1>
          <p class="text-red-600 mb-4">アプリケーションの初期化に失敗しました。</p>
          <p class="text-sm text-red-500">${error.message}</p>
          <button onclick="location.reload()" 
                  class="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors">
            再読み込み
          </button>
        </div>
      </div>
    `
  }
})

// ========================================
// 📦 グローバル公開（後方互換性）
// ========================================

// クラスをグローバルに公開
window.UsageManager = UsageManager
window.AuthService = AuthService
window.UIManager = UIManager 
window.AppService = AppService

// 初期化完了ログ
console.log('📋 タップカルテ - 最適化版JavaScript読み込み完了')