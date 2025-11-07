/**
 * タップカルテ - リファクタリング版統合フロントエンド
 * 
 * クリーンアーキテクチャに基づく統合JavaScript
 */

// ========================================
// 🔐 認証サービス（AuthService）
// ========================================

/**
 * 認証サービスクラス
 */
class AuthService {
  constructor() {
    /** @type {Object|null} 現在のユーザー */
    this.currentUser = null
    
    /** @type {string|null} 認証トークン */
    this.authToken = null
    
    /** @type {Array<Function>} 認証状態変更リスナー */
    this.authListeners = []
    
    /** @type {Object} 設定 */
    this.config = {
      apiBaseUrl: '/api',
      tokenStorageKey: 'demo_auth_token',
      userStorageKey: 'demo_user_data',
      sessionCheckInterval: 5 * 60 * 1000, // 5分
      autoRefreshInterval: 30 * 60 * 1000  // 30分
    }
    
    /** @type {number|null} セッション監視タイマー */
    this.sessionTimer = null
    
    /** @type {number|null} 自動更新タイマー */
    this.refreshTimer = null
    
    console.log('[AuthService] Initialized')
  }

  // ========================================
  // 🚀 認証処理
  // ========================================

  /**
   * パスワード認証ログイン処理
   * @param {string} password - パスワード
   * @returns {Promise<boolean>} ログイン成功フラグ
   */
  async login(password) {
    try {
      console.log('[AuthService] Starting password login...')
      
      if (!password) {
        throw new Error('パスワードが入力されていません')
      }
      
      const response = await fetch(`${this.config.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `ログインに失敗しました: ${response.status}`)
      }
      
      if (data.success && data.data && data.data.user && data.data.token) {
        // 認証情報を保存
        this.currentUser = data.data.user
        this.authToken = data.data.token
        
        // ローカルストレージに保存
        localStorage.setItem(this.config.tokenStorageKey, data.data.token)
        localStorage.setItem(this.config.userStorageKey, JSON.stringify(data.data.user))
        
        // セッション監視を開始
        this.startSessionMonitoring()
        
        // リスナーに通知
        this.notifyAuthListeners(true)
        
        console.log('[AuthService] Login successful:', data.data.user.name)
        return true
      } else {
        throw new Error(data.error || 'ログインレスポンスが無効です')
      }
    } catch (error) {
      console.error('[AuthService] Login error:', error)
      throw error
    }
  }

  /**
   * レガシーデモログイン（後方互換性のため）
   * @deprecated パスワード認証を使用してください
   */
  async demoLogin() {
    throw new Error('デモログインは無効化されました。パスワードを入力してログインしてください。')
  }

  /**
   * ログアウト処理
   */
  async logout() {
    try {
      console.log('[AuthService] Starting logout...')
      
      // セッション監視を停止
      this.stopSessionMonitoring()
      
      // ローカルストレージをクリア
      localStorage.removeItem(this.config.tokenStorageKey)
      localStorage.removeItem(this.config.userStorageKey)
      
      // 状態をリセット
      this.currentUser = null
      this.authToken = null
      
      // リスナーに通知
      this.notifyAuthListeners(false)
      
      console.log('[AuthService] Logout completed')
    } catch (error) {
      console.error('[AuthService] Logout error:', error)
    }
  }

  // ========================================
  // 🔍 セッション管理
  // ========================================

  /**
   * セッション監視を開始
   */
  startSessionMonitoring() {
    console.log('[AuthService] Starting session monitoring')
    
    // 既存のタイマーをクリア
    this.stopSessionMonitoring()
    
    // 定期セッションチェック
    this.sessionTimer = setInterval(() => {
      this.validateSession()
    }, this.config.sessionCheckInterval)
    
    // 自動トークン更新
    this.refreshTimer = setInterval(() => {
      this.refreshToken()
    }, this.config.autoRefreshInterval)
  }

  /**
   * セッション監視を停止
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
   * セッション状態を検証
   */
  async validateSession() {
    if (!this.authToken) return false
    
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
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
   * 認証トークンを更新
   */
  async refreshToken() {
    if (!this.authToken) return false
    
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/auth/refresh`, {
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
          localStorage.setItem(this.config.tokenStorageKey, data.token)
          console.log('[AuthService] Token refreshed successfully')
        }
      }
    } catch (error) {
      console.error('[AuthService] Token refresh error:', error)
    }
  }

  // ========================================
  // 📡 状態管理とリスナー
  // ========================================

  /**
   * 認証状態リスナーを追加
   * @param {Function} callback コールバック関数
   */
  addAuthListener(callback) {
    this.authListeners.push(callback)
  }

  /**
   * 認証状態リスナーを削除
   * @param {Function} callback コールバック関数
   */
  removeAuthListener(callback) {
    const index = this.authListeners.indexOf(callback)
    if (index > -1) {
      this.authListeners.splice(index, 1)
    }
  }

  /**
   * 認証状態リスナーに通知
   * @param {boolean} isAuthenticated 認証状態
   */
  notifyAuthListeners(isAuthenticated) {
    this.authListeners.forEach(callback => {
      try {
        callback(isAuthenticated, this.currentUser)
      } catch (error) {
        console.error('[AuthService] Listener callback error:', error)
      }
    })
  }

  // ========================================
  // ⚙️ ユーティリティ
  // ========================================

  /**
   * 認証済み状態かチェック
   * @returns {boolean} 認証状態
   */
  isAuthenticated() {
    return !!(this.currentUser && this.authToken)
  }

  /**
   * 現在のユーザー情報を取得
   * @returns {Object|null} ユーザー情報
   */
  getCurrentUser() {
    return this.currentUser
  }

  /**
   * 認証トークンを取得
   * @returns {string|null} 認証トークン
   */
  getAuthToken() {
    return this.authToken
  }

  /**
   * 保存された認証情報をロード
   */
  loadStoredAuth() {
    try {
      const storedToken = localStorage.getItem(this.config.tokenStorageKey)
      const storedUser = localStorage.getItem(this.config.userStorageKey)
      
      if (storedToken && storedUser) {
        this.authToken = storedToken
        this.currentUser = JSON.parse(storedUser)
        this.startSessionMonitoring()
        console.log('[AuthService] Stored auth loaded:', this.currentUser.name)
        return true
      }
    } catch (error) {
      console.error('[AuthService] Error loading stored auth:', error)
      // 破損したデータをクリア
      localStorage.removeItem(this.config.tokenStorageKey)
      localStorage.removeItem(this.config.userStorageKey)
    }
    return false
  }
}

// ========================================
// 🎨 認証UIコンポーネント（AuthComponent）
// ========================================

/**
 * 認証UIコンポーネントクラス
 */
class AuthComponent {
  constructor(authService) {
    /** @type {AuthService} 認証サービス */
    this.authService = authService
    
    /** @type {Object} DOM要素の参照 */
    this.elements = {}
    
    /** @type {boolean} 初期化済みフラグ */
    this.initialized = false
    
    console.log('[AuthComponent] Initialized')
  }

  // ========================================
  // 🚀 初期化
  // ========================================

  /**
   * コンポーネントを初期化
   */
  initialize() {
    if (this.initialized) {
      console.log('[AuthComponent] Already initialized')
      return
    }
    
    console.log('[AuthComponent] Initializing...')
    
    // DOM要素を取得
    this.cacheDOMElements()
    
    // イベントリスナーを設定
    this.setupEventListeners()
    
    // 認証状態リスナーを追加
    this.authService.addAuthListener((isAuthenticated, user) => {
      this.updateUI(isAuthenticated, user)
    })
    
    // 初期状態を表示
    this.updateUI(this.authService.isAuthenticated(), this.authService.getCurrentUser())
    
    this.initialized = true
    console.log('[AuthComponent] Initialization completed')
  }

  /**
   * DOM要素をキャッシュ
   */
  cacheDOMElements() {
    this.elements = {
      // 認証モーダル
      authModal: document.getElementById('auth-modal'),
      
      // ログインボタン
      loginBtn: document.getElementById('login-btn'),
      passwordLoginBtn: document.getElementById('password-login-btn'),
      
      // ログインフォーム
      loginForm: document.getElementById('login-form'),
      loginPassword: document.getElementById('login-password'),
      
      // ユーザー情報
      userStatus: document.getElementById('user-status'),
      authButtons: document.getElementById('auth-buttons'),
      userName: document.getElementById('user-name'),
      userAvatar: document.getElementById('user-avatar'),
      logoutBtn: document.getElementById('logout-btn'),
      
      // モーダル制御
      closeModal: document.getElementById('close-modal'),
      closeModalBtns: document.querySelectorAll('[id="close-modal"]'),
      
      // エラー表示
      loginError: document.getElementById('login-error'),
      loginErrorMessage: document.getElementById('login-error-message'),
      
      // ローディング表示
      loginBtnText: document.getElementById('login-btn-text'),
      loginSpinner: document.getElementById('login-spinner')
    }
    
    console.log('[AuthComponent] DOM elements cached')
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // ログインボタン
    if (this.elements.loginBtn) {
      this.elements.loginBtn.addEventListener('click', () => {
        this.showAuthModal()
      })
    }
    
    // パスワードログインフォーム
    if (this.elements.loginForm) {
      this.elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        await this.handlePasswordLogin()
      })
    }
    
    // デモログインボタン（レガシー対応）
    if (this.elements.demoLoginBtn) {
      this.elements.demoLoginBtn.addEventListener('click', async () => {
        await this.handleDemoLogin()
      })
    }
    
    // ログアウトボタン
    if (this.elements.logoutBtn) {
      this.elements.logoutBtn.addEventListener('click', async () => {
        await this.handleLogout()
      })
    }
    
    // モーダル閉じるボタン
    if (this.elements.closeModal) {
      this.elements.closeModal.addEventListener('click', () => {
        this.hideAuthModal()
      })
    }
    
    // 複数のモーダル閉じるボタンがある場合
    if (this.elements.closeModalBtns && this.elements.closeModalBtns.length > 0) {
      this.elements.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.hideAuthModal()
        })
      })
    }
    
    // モーダル背景クリックで閉じる
    if (this.elements.authModal) {
      this.elements.authModal.addEventListener('click', (e) => {
        if (e.target === this.elements.authModal) {
          this.hideAuthModal()
        }
      })
    }
    
    // パスワード入力でエラーをクリア
    if (this.elements.loginPassword) {
      this.elements.loginPassword.addEventListener('input', () => {
        this.clearError()
      })
    }
    
    console.log('[AuthComponent] Event listeners setup completed')
  }

  // ========================================
  // 🎯 認証処理
  // ========================================

  /**
   * パスワードログイン処理
   */
  async handlePasswordLogin() {
    try {
      console.log('[AuthComponent] Processing password login...')
      
      // パスワードを取得
      const password = this.elements.loginPassword ? this.elements.loginPassword.value.trim() : ''
      
      if (!password) {
        this.showError('パスワードを入力してください')
        return
      }
      
      // ローディング状態を表示
      this.setLoadingState(true)
      this.clearError()
      
      // 認証サービスでパスワードログイン実行
      await this.authService.login(password)
      
      // モーダルを閉じる
      this.hideAuthModal()
      
      // フォームをリセット
      if (this.elements.loginForm) {
        this.elements.loginForm.reset()
      }
      
      console.log('[AuthComponent] Password login completed successfully')
      
    } catch (error) {
      console.error('[AuthComponent] Password login failed:', error)
      this.showError(`ログインに失敗しました: ${error.message}`)
    } finally {
      this.setLoadingState(false)
    }
  }

  /**
   * デモログイン処理（レガシー互換性）
   * @deprecated パスワード認証を使用してください
   */
  async handleDemoLogin() {
    try {
      console.log('[AuthComponent] Processing demo login...')
      
      // ローディング状態を表示
      this.setLoadingState(true)
      this.clearError()
      
      // 認証サービスでデモログイン実行（エラーが発生）
      await this.authService.demoLogin()
      
    } catch (error) {
      console.error('[AuthComponent] Demo login failed:', error)
      this.showError(`デモログインは無効化されました。パスワードを入力してログインしてください。`)
    } finally {
      this.setLoadingState(false)
    }
  }

  /**
   * ログアウト処理
   */
  async handleLogout() {
    try {
      console.log('[AuthComponent] Processing logout...')
      
      // 確認ダイアログ
      if (!confirm('ログアウトしますか？')) {
        return
      }
      
      // 認証サービスでログアウト実行
      await this.authService.logout()
      
      console.log('[AuthComponent] Logout completed successfully')
      
    } catch (error) {
      console.error('[AuthComponent] Logout failed:', error)
      this.showError(`ログアウトに失敗しました: ${error.message}`)
    }
  }

  // ========================================
  // 🎨 UI更新
  // ========================================

  /**
   * UI状態を更新
   * @param {boolean} isAuthenticated 認証状態
   * @param {Object|null} user ユーザー情報
   */
  updateUI(isAuthenticated, user) {
    console.log('[AuthComponent] Updating UI:', { isAuthenticated, user: user?.name })
    
    if (isAuthenticated && user) {
      this.showAuthenticatedUI(user)
    } else {
      this.showUnauthenticatedUI()
    }
  }

  /**
   * 認証済みUI表示
   * @param {Object} user ユーザー情報
   */
  showAuthenticatedUI(user) {
    // 認証ボタンエリアを非表示
    if (this.elements.authButtons) {
      this.elements.authButtons.style.display = 'none'
    }
    
    // ユーザー情報を表示
    if (this.elements.userStatus) {
      this.elements.userStatus.style.display = 'block'
    }
    
    // ユーザー名を設定
    if (this.elements.userName) {
      this.elements.userName.textContent = user.name
    }
    
    // ユーザー画像を設定
    if (user.picture && this.elements.userAvatar) {
      this.elements.userAvatar.src = user.picture
      this.elements.userAvatar.style.display = 'block'
    }
    
    console.log('[AuthComponent] Authenticated UI displayed for:', user.name)
  }

  /**
   * 未認証UI表示
   */
  showUnauthenticatedUI() {
    // 認証ボタンエリアを表示
    if (this.elements.authButtons) {
      this.elements.authButtons.style.display = 'block'
    }
    
    // ログインボタンを表示
    if (this.elements.loginBtn) {
      this.elements.loginBtn.style.display = 'inline-flex'
    }
    
    // ユーザー情報を非表示
    if (this.elements.userStatus) {
      this.elements.userStatus.style.display = 'none'
    }
    
    console.log('[AuthComponent] Unauthenticated UI displayed')
  }

  // ========================================
  // 🪟 モーダル制御
  // ========================================

  /**
   * 認証モーダルを表示
   */
  showAuthModal() {
    if (this.elements.authModal) {
      this.elements.authModal.style.display = 'flex'
      this.clearError()
      console.log('[AuthComponent] Auth modal shown')
    }
  }

  /**
   * 認証モーダルを非表示
   */
  hideAuthModal() {
    if (this.elements.authModal) {
      this.elements.authModal.style.display = 'none'
      this.setLoadingState(false)
      this.clearError()
      console.log('[AuthComponent] Auth modal hidden')
    }
  }

  // ========================================
  // ⚠️ エラー処理とUIフィードバック
  // ========================================

  /**
   * エラーを表示
   * @param {string} message エラーメッセージ
   */
  showError(message) {
    if (this.elements.authError) {
      this.elements.authError.textContent = message
      this.elements.authError.style.display = 'block'
    }
    console.error('[AuthComponent] Error displayed:', message)
  }

  /**
   * エラーをクリア
   */
  clearError() {
    if (this.elements.authError) {
      this.elements.authError.style.display = 'none'
      this.elements.authError.textContent = ''
    }
  }

  /**
   * ローディング状態を設定
   * @param {boolean} loading ローディング状態
   */
  setLoadingState(loading) {
    // ログインフォーム関連の要素を無効化
    if (this.elements.loginPassword) {
      this.elements.loginPassword.disabled = loading
    }
    
    // ログインボタンの状態更新
    const loginSubmitBtn = document.querySelector('#login-form button[type="submit"]')
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = loading
    }
    
    // ローディング表示の切り替え
    if (this.elements.loginBtnText && this.elements.loginSpinner) {
      if (loading) {
        this.elements.loginBtnText.style.display = 'none'
        this.elements.loginSpinner.style.display = 'inline-block'
      } else {
        this.elements.loginBtnText.style.display = 'inline'
        this.elements.loginSpinner.style.display = 'none'
      }
    }
    
    // デモログインボタン（レガシー対応）
    if (this.elements.demoLoginBtn) {
      this.elements.demoLoginBtn.disabled = loading
      this.elements.demoLoginBtn.textContent = loading ? 'ログイン中...' : 'デモログイン'
    }
  }
  
  /**
   * 生成ボタンを有効化
   */
  enableGenerationButton() {
    const generateBtn = document.getElementById('generate-btn')
    const authMessage = document.getElementById('auth-required-message')
    
    if (generateBtn) {
      generateBtn.disabled = false
      generateBtn.classList.remove('opacity-50', 'cursor-not-allowed')
      generateBtn.classList.add('hover:bg-blue-700')
    }
    
    if (authMessage) {
      authMessage.style.display = 'none'
    }
    
    console.log('[AuthComponent] Generation button enabled')
  }
  
  /**
   * 生成ボタンを無効化
   */
  disableGenerationButton() {
    const generateBtn = document.getElementById('generate-btn')
    const authMessage = document.getElementById('auth-required-message')
    
    if (generateBtn) {
      generateBtn.disabled = true
      generateBtn.classList.add('opacity-50', 'cursor-not-allowed')
      generateBtn.classList.remove('hover:bg-blue-700')
    }
    
    if (authMessage) {
      authMessage.style.display = 'block'
    }
    
    console.log('[AuthComponent] Generation button disabled')
  }
}

// ========================================
// 🎯 アプリケーション管理（AppService）
// ========================================

/**
 * アプリケーション管理サービス
 */
class AppService {
  constructor() {
    /** @type {AuthService} 認証サービス */
    this.authService = new AuthService()
    
    /** @type {AuthComponent} 認証UIコンポーネント */
    this.authComponent = new AuthComponent(this.authService)
    
    /** @type {UsageManager} 使用回数管理 */
    this.usageManager = window.UsageManager ? new window.UsageManager() : null
    
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
  // 🚀 初期化
  // ========================================

  /**
   * アプリケーションを初期化
   */
  async initialize() {
    try {
      console.log('[AppService] Starting application initialization...')
      
      // 保存された認証情報をロード
      this.authService.loadStoredAuth()
      
      // 使用制限システムを初期化（認証UIより先に）
      this.initializeUsageControl()
      
      // 認証UIコンポーネントを初期化
      this.authComponent.initialize()
      
      // 変換フォームを初期化
      this.initializeConversionForm()
      
      // 履歴を初期化
      this.initializeHistory()
      
      // その他のUI要素を初期化
      this.initializeOtherElements()
      
      this.state.initialized = true
      console.log('[AppService] Application initialization completed')
      
    } catch (error) {
      console.error('[AppService] Initialization error:', error)
      throw error
    }
  }

  /**
   * 変換フォームを初期化
   */
  initializeConversionForm() {
    const textInput = document.getElementById('input-text')
    const generateBtn = document.getElementById('generate-btn')
    
    if (textInput && generateBtn) {
      // 生成ボタンのクリックイベント
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
   * 履歴を初期化
   */
  initializeHistory() {
    try {
      // ローカルストレージから履歴を読み込み
      const storedHistory = localStorage.getItem('conversionHistory')
      if (storedHistory) {
        this.state.conversionHistory = JSON.parse(storedHistory)
        this.displayConversionHistory()
      }
      
      console.log('[AppService] History initialized:', this.state.conversionHistory.length, 'items')
    } catch (error) {
      console.error('[AppService] History initialization error:', error)
      this.state.conversionHistory = []
    }
  }

  // ========================================
  // 🔄 AI変換処理
  // ========================================

  /**
   * AI変換を実行
   */
  async handleConversion() {
    if (this.state.isProcessing) {
      console.log('[AppService] Conversion already in progress')
      return
    }
    
    try {
      const textInput = document.getElementById('input-text')
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
      
      // 文字制限スライダーの値を取得
      const charLimitSlider = document.getElementById('char-limit-slider')
      const charLimit = charLimitSlider ? parseInt(charLimitSlider.value) : 500

      // 選択されたオプションを取得
      const selectedOptions = this.getSelectedOptions()
      
      console.log('[AppService] Selected options:', selectedOptions)

      // API呼び出し
      const response = await fetch('/api/ai/convert', {
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
        // APIレスポンス構造に合わせて変換結果を準備
        const convertedText = result.data.result || ''
        const responseTime = result.data.responseTime || 0
        
        // 変換結果オブジェクトを構築
        const conversionResult = {
          converted_text: convertedText,
          suggestions: [], // 現在のAPIは提案機能なし
          response_time: responseTime
        }
        
        // 変換結果を表示
        this.displayConversionResult(conversionResult)
        
        // ゲスト使用を記録
        this.recordGuestUsage()
        
        // 履歴に追加
        this.addToHistory({
          id: Date.now(),
          originalText: text,
          convertedText: convertedText,
          suggestions: [],
          timestamp: new Date().toISOString(),
          user: this.authService.getCurrentUser()
        })
        
        // フォームをクリア
        textInput.value = ''
        this.updateCharacterCount()
        
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

  // ========================================
  // 🎨 UI更新とフィードバック
  // ========================================

  /**
   * 変換結果を表示
   * @param {Object} result 変換結果
   */
  displayConversionResult(result) {
    const outputText = document.getElementById('output-text')
    const outputCount = document.getElementById('output-count')
    
    if (!outputText) {
      console.error('[AppService] Output text element not found')
      return
    }
    
    const convertedText = result.converted_text || '変換結果が空です'
    
    // 出力エリアに結果を表示
    outputText.innerHTML = convertedText.replace(/\n/g, '<br>')
    
    // 文字数を更新
    if (outputCount) {
      outputCount.textContent = `${convertedText.length}文字`
    }
    
    // コピーボタンを有効化
    const copyBtn = document.getElementById('copy-btn')
    if (copyBtn) {
      copyBtn.disabled = false
      copyBtn.onclick = () => this.copyResult(convertedText)
    }
    
    console.log('[AppService] Conversion result displayed:', convertedText.length, 'characters')
  }

  /**
   * 変換履歴を表示
   */
  displayConversionHistory() {
    const historyContainer = document.getElementById('conversionHistory')
    if (!historyContainer || this.state.conversionHistory.length === 0) return
    
    const historyHtml = this.state.conversionHistory
      .slice(-5) // 最新5件のみ表示
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
   * 文字数カウントを更新
   */
  updateCharacterCount() {
    const textInput = document.getElementById('input-text')
    const charCount = document.getElementById('input-count')
    
    if (textInput && charCount) {
      const length = textInput.value.length
      charCount.textContent = `${length}文字`
      
      // 文字数制限の視覚的フィードバック
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
   * 変換エラーを表示
   * @param {string} message エラーメッセージ
   */
  showConversionError(message) {
    const resultContainer = document.getElementById('conversionResult')
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
   * 変換処理のローディング状態を設定
   * @param {boolean} loading ローディング状態
   */
  setConversionLoadingState(loading) {
    const generateBtn = document.getElementById('generate-btn')
    const textInput = document.getElementById('input-text')
    
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
   * 履歴にアイテムを追加
   * @param {Object} item 履歴アイテム
   */
  addToHistory(item) {
    this.state.conversionHistory.push(item)
    
    // 最新50件のみ保持
    if (this.state.conversionHistory.length > 50) {
      this.state.conversionHistory = this.state.conversionHistory.slice(-50)
    }
    
    // ローカルストレージに保存
    try {
      localStorage.setItem('conversionHistory', JSON.stringify(this.state.conversionHistory))
    } catch (error) {
      console.error('[AppService] History save error:', error)
    }
    
    // 履歴表示を更新
    this.displayConversionHistory()
  }

  /**
   * 履歴アイテムを読み込み
   * @param {number} itemId アイテムID
   */
  loadHistoryItem(itemId) {
    const item = this.state.conversionHistory.find(h => h.id === itemId)
    if (!item) return
    
    const textInput = document.getElementById('input-text')
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
   * テキストをクリップボードにコピー
   * @param {string} text コピーするテキスト
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
      }, 2000)
      
      console.log('[AppService] Text copied to clipboard')
    } catch (error) {
      console.error('[AppService] Copy error:', error)
      alert('コピーに失敗しました')
    }
  }

  /**
   * アプリケーション統計を取得
   * @returns {Object} 統計情報
   */
  getAppStats() {
    return {
      totalConversions: this.state.conversionHistory.length,
      isAuthenticated: this.authService.isAuthenticated(),
      currentUser: this.authService.getCurrentUser(),
      initialized: this.state.initialized
    }

  }

  /**
   * その他のUI要素を初期化
   */
  initializeOtherElements() {
    // クリアボタンの初期化
    const clearBtn = document.getElementById('clear-input')
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearInput()
      })
      console.log('[AppService] Clear button initialized')
    }
    
    // 文字制限スライダーの初期化
    this.initializeCharacterLimitSlider()
    
    // 選択ボタンの初期化
    this.initializeOptionButtons()
  }

  /**
   * 文字制限スライダーを初期化
   */
  initializeCharacterLimitSlider() {
    const slider = document.getElementById('char-limit-slider')
    const display = document.getElementById('char-limit-display')
    
    if (slider && display) {
      slider.addEventListener('input', (e) => {
        const value = e.target.value
        display.textContent = `${value}文字`
      })
      console.log('[AppService] Character limit slider initialized')
    }
  }

  /**
   * 選択ボタン機能を初期化
   */
  initializeOptionButtons() {
    // ドキュメント選択ボタン
    this.initializeButtonGroup(['doc-record', 'doc-report'])
    this.selectButton(['doc-record', 'doc-report'], 'doc-record') // デフォルト選択
    
    // フォーマット選択ボタン
    this.initializeButtonGroup(['format-text', 'format-soap'])
    this.selectButton(['format-text', 'format-soap'], 'format-text') // デフォルト選択
    
    // 文体選択ボタン
    this.initializeButtonGroup(['style-plain', 'style-polite'])
    this.selectButton(['style-plain', 'style-polite'], 'style-plain') // デフォルト選択
    
    console.log('[AppService] Option buttons initialized with default selections')
  }

  /**
   * ボタングループの初期化
   */
  initializeButtonGroup(buttonIds) {
    buttonIds.forEach(buttonId => {
      const button = document.getElementById(buttonId)
      if (button) {
        button.addEventListener('click', () => {
          this.selectButton(buttonIds, buttonId)
        })
        console.log(`[AppService] Button event listener added: ${buttonId}`)
      } else {
        console.error(`[AppService] Button not found: ${buttonId}`)
      }
    })
  }

  /**
   * ボタンを選択状態にする
   */
  selectButton(groupIds, selectedId) {
    groupIds.forEach(id => {
      const button = document.getElementById(id)
      if (button) {
        // 既存のクラスをクリアして新しいクラスを設定
        const baseClasses = 'px-4 py-2 rounded-md text-sm font-medium transition-colors'
        
        if (id === selectedId) {
          // 選択状態
          button.className = `${baseClasses} bg-pink-600 text-white hover:bg-pink-700`
        } else {
          // 非選択状態
          button.className = `${baseClasses} bg-pink-100 text-pink-700 hover:bg-pink-200`
        }
      }
    })
    
    console.log(`[AppService] Button selected: ${selectedId} in group [${groupIds.join(', ')}]`)
  }

  /**
   * 入力をクリア
   */
  clearInput() {
    const textInput = document.getElementById('input-text')
    if (textInput) {
      textInput.value = ''
      this.updateCharacterCount()
      textInput.focus()
    }
  }

  /**
   * 選択されたオプションを取得
   */
  getSelectedOptions() {
    // デフォルト値
    let docType = '記録'
    let format = '文章形式'
    let style = 'だ・である体'
    
    // ドキュメント種別の確認
    const docRecordBtn = document.getElementById('doc-record')
    const docReportBtn = document.getElementById('doc-report')
    if (docReportBtn && docReportBtn.classList.contains('bg-pink-600')) {
      docType = '報告書'
    }
    
    // フォーマットの確認
    const formatTextBtn = document.getElementById('format-text')
    const formatSoapBtn = document.getElementById('format-soap')
    if (formatSoapBtn && formatSoapBtn.classList.contains('bg-pink-600')) {
      format = 'SOAP形式'
    }
    
    // 文体の確認
    const stylePlainBtn = document.getElementById('style-plain')
    const stylePoliteBtn = document.getElementById('style-polite')
    if (stylePoliteBtn && stylePoliteBtn.classList.contains('bg-pink-600')) {
      style = 'ですます体'
    }
    
    return {
      docType,
      format,
      style
    }
  }

  // ========================================
  // 📊 使用制限システム
  // ========================================
  
  /**
   * 使用制限システムを初期化
   */
  initializeUsageControl() {
    if (!this.usageManager) {
      console.warn("[AppService] UsageManager not available")
      return
    }
    
    // 認証状態変更時の使用制限更新
    this.authService.addAuthListener((isAuthenticated) => {
      this.updateUsageLimits(isAuthenticated)
    })
    
    // 初期状態の使用制限を設定
    this.updateUsageLimits(this.authService.isAuthenticated())
    
    console.log("[AppService] Usage control initialized")
  }
  
  /**
   * 使用制限の状態を更新
   * @param {boolean} isAuthenticated ログイン状態
   */
  updateUsageLimits(isAuthenticated) {
    const generateBtn = document.getElementById("generate-btn")
    const authMessage = document.getElementById("auth-required-message")
    const usageMessage = this.getOrCreateUsageLimitMessage()
    
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
      
      // ゲストユーザーは認証メッセージを非表示（使用制限メッセージを使用）
      if (authMessage) authMessage.style.display = "none"
      
      if (usageMessage) {
        if (canGenerate) {
          usageMessage.style.display = "none"
        } else {
          usageMessage.style.display = "block"
usageMessage.innerHTML = `<div class="flex items-center space-x-2"><i class="fas fa-clock text-red-600"></i><span class="text-sm font-semibold text-red-700">本日の利用回数を超えました</span></div><p class="text-sm text-red-600 mt-1">ゲストユーザーは1日3回まで無料でご利用いただけます。無制限利用にはログインが必要です。</p>`
        }
      }
      
      console.log("[AppService] Guest usage limits updated:", { canGenerate })
    }
  }
  
  /**
   * 使用制限メッセージ要素を取得または作成
   * @returns {HTMLElement} 使用制限メッセージ要素
   */
  getOrCreateUsageLimitMessage() {
    return document.getElementById("usage-limit-message")
  }
  
  /**
   * 生成実行時の使用制限チェック
   * @returns {boolean} 生成可能かどうか
   */
  checkUsageLimits() {
    const isAuthenticated = this.authService.isAuthenticated()
    
    if (isAuthenticated) {
      // ログインユーザーは無制限
      return true
    }
    
    if (!this.usageManager) {
      console.warn("[AppService] UsageManager not available, allowing generation")
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
   * 使用制限エラーを表示
   */
  showUsageLimitError() {
const errorMessage = "本日の利用回数を超えました。ゲストユーザーは1日3回まで無料でご利用いただけます。無制限利用にはログインしてください。"
    alert(errorMessage)
  }
  
  /**
   * ゲスト利用を記録
   */
  recordGuestUsage() {
    if (this.usageManager && !this.authService.isAuthenticated()) {
      this.usageManager.recordGuestUsage()
      // 使用制限を再更新
      this.updateUsageLimits(false)
    }
  }
}

// ========================================
// 🌍 グローバル初期化
// ========================================

// グローバルアプリケーションインスタンス
let app

/**
 * アプリケーション初期化処理
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 タップカルテ - リファクタリング版 起動中...')
    
    // アプリケーションサービスを作成
    app = new AppService()
    
    // グローバルに露出（デバッグ用）
    window.app = app
    
    // アプリケーションを初期化
    await app.initialize()
    
    console.log('✅ タップカルテ - リファクタリング版 起動完了')
    
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

console.log('📋 タップカルテ - リファクタリング版JavaScript読み込み完了')
