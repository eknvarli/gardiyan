import React, { useState, useEffect, useCallback } from 'react';

interface Credentials {
  username: string;
  password: string;
}

interface License {
  id: number;
  key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SecurityAlert {
  show: boolean;
  title: string;
  message: string;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  recent: number;
}

const App: React.FC = () => {
  const API_BASE = 'http://127.0.0.1:8000/api';
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<Credentials>({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const maxLoginAttempts = 5;
  const [loginTimeout, setLoginTimeout] = useState(0);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLicense, setNewLicense] = useState({
    key: '',
    author: 1,
  });
  const [userIP, setUserIP] = useState('192.168.1.1');
  const [lastActivity, setLastActivity] = useState(new Date().toLocaleTimeString('tr-TR'));
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(300);
  const [securityAlert, setSecurityAlert] = useState<SecurityAlert>({
    show: false,
    title: '',
    message: ''
  });
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    inactive: 0,
    recent: 0
  });

  const filteredLicenses = licenses.filter(license => {
    const matchesSearch = searchQuery 
      ? license.key.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesStatus = statusFilter !== 'all'
      ? license.is_active === (statusFilter === 'active')
      : true;
    
    return matchesSearch && matchesStatus;
  });

  const userInitials = credentials.username ? credentials.username.charAt(0).toUpperCase() : 'A';

  useEffect(() => {
    detectIP();
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
      fetchLicenses();
      startSessionTimer();
      startActivityTracker();
    }
  }, []);

  const detectIP = () => {
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => {
        setUserIP(data.ip);
      })
      .catch(() => {
        setUserIP('127.0.0.1');
      });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginAttempts >= maxLoginAttempts) {
      showSecurityAlert('Güvenlik Kilidi', 'Çok fazla başarısız giriş denemesi. Lütfen 5 dakika bekleyin.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem('authToken', data.token);
        setIsAuthenticated(true);
        setLoginAttempts(0);
        await fetchLicenses();
        startSessionTimer();
        startActivityTracker();
      } else {
        setLoginAttempts(prev => prev + 1);
        if (loginAttempts + 1 >= maxLoginAttempts) {
          startLoginTimeout();
        }
        showSecurityAlert('Giriş Başarısız', data.error || 'Kullanıcı adı veya şifre hatalı.');
      }
    } catch (err) {
      setLoginAttempts(prev => prev + 1);
      showSecurityAlert('Bağlantı Hatası', 'Sunucuya bağlanılamadı. Lütfen CORS ayarlarını kontrol edin.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const startLoginTimeout = () => {
    setLoginTimeout(300);
    const interval = setInterval(() => {
      setLoginTimeout(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setLoginAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startSessionTimer = () => {
    setInterval(() => {
      setSessionTimeLeft(prev => {
        if (prev <= 60) {
          setSessionTimeoutWarning(true);
        }
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startActivityTracker = () => {
    const resetTimer = () => {
      setSessionTimeLeft(300);
      setLastActivity(new Date().toLocaleTimeString('tr-TR'));
      setSessionTimeoutWarning(false);
    };

    document.addEventListener('mousemove', resetTimer);
    document.addEventListener('keypress', resetTimer);
    document.addEventListener('click', resetTimer);

    return () => {
      document.removeEventListener('mousemove', resetTimer);
      document.removeEventListener('keypress', resetTimer);
      document.removeEventListener('click', resetTimer);
    };
  };

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/licenses/`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLicenses(data);
        calculateStats(data);
      } else if (response.status === 401) {
        handleLogout();
        showSecurityAlert('Oturum Süresi Doldu', 'Lütfen tekrar giriş yapın.');
      }
    } catch (err) {
      showSecurityAlert('Veri Hatası', 'Lisanslar yüklenirken hata oluştu.');
      console.error('Fetch licenses error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (licenseData: License[]) => {
    const total = licenseData.length;
    const active = licenseData.filter(l => l.is_active).length;
    const inactive = licenseData.filter(l => !l.is_active).length;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = licenseData.filter(l => new Date(l.created_at) > weekAgo).length;
    
    setStats({ total, active, inactive, recent });
  };

  const addLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/licenses/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newLicense)
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewLicense({ ...newLicense, key: '' });
        await fetchLicenses();
      } else {
        const error = await response.json();
        showSecurityAlert('Hata', error.detail || 'Lisans eklenirken hata oluştu.');
      }
    } catch (err) {
      showSecurityAlert('Bağlantı Hatası', 'Sunucuya bağlanılamadı.');
      console.error('Add license error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleLicense = async (license: License) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/licenses/${license.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_active: !license.is_active
        })
      });

      if (response.ok) {
        await fetchLicenses();
      } else {
        showSecurityAlert('Hata', 'Lisans güncellenirken hata oluştu.');
      }
    } catch (err) {
      showSecurityAlert('Hata', 'Lisans güncellenirken hata oluştu.');
      console.error('Toggle license error:', err);
    }
  };

  const deleteLicense = async (licenseId: number) => {
    if (!confirm('Bu lisansı silmek istediğinizden emin misiniz?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/licenses/${licenseId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${token}`
        }
      });

      if (response.ok) {
        await fetchLicenses();
      } else {
        showSecurityAlert('Hata', 'Lisans silinirken hata oluştu.');
      }
    } catch (err) {
      showSecurityAlert('Hata', 'Lisans silinirken hata oluştu.');
      console.error('Delete license error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setCredentials({ username: '', password: '' });
    setSessionTimeoutWarning(false);
    setSessionTimeLeft(300);
  };

  const showSecurityAlert = (title: string, message: string) => {
    setSecurityAlert({
      show: true,
      title,
      message
    });
  };

  const dismissSecurityAlert = () => {
    setSecurityAlert({ ...securityAlert, show: false });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const handleCredentialsChange = (field: keyof Credentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const handleNewLicenseChange = (value: string) => {
    setNewLicense(prev => ({ ...prev, key: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 font-inter">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-1/4 left-1/2 w-64 h-64 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>
      </div>

      {securityAlert.show && (
        <div className="fixed inset-0 bg-red-900 bg-opacity-90 z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md mx-4">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">{securityAlert.title}</h3>
            <p className="text-gray-600 text-center mb-6">{securityAlert.message}</p>
            <button 
              onClick={dismissSecurityAlert}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      {sessionTimeoutWarning && (
        <div className="fixed top-4 right-4 bg-orange-500 text-white p-4 rounded-lg shadow-lg z-40">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Oturum süresi dolmak üzere: {sessionTimeLeft}s</span>
          </div>
        </div>
      )}

      <div className="relative z-10">
        {!isAuthenticated ? (
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Gardiyan</h1>
                  <p className="text-white/70">Yüksek Güvenlikli Lisans Yönetimi</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Kullanıcı Adı</label>
                    <div className="relative">
                      <input 
                        value={credentials.username}
                        onChange={(e) => handleCredentialsChange('username', e.target.value)}
                        type="text"
                        required
                        disabled={loginAttempts >= maxLoginAttempts}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
                        placeholder="admin"
                      />
                      <div className="absolute right-3 top-3">
                        <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Şifre</label>
                    <div className="relative">
                      <input 
                        value={credentials.password}
                        onChange={(e) => handleCredentialsChange('password', e.target.value)}
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={loginAttempts >= maxLoginAttempts}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-white/50 hover:text-white transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {showPassword ? (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </>
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>

                  {loginAttempts > 0 && (
                    <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between text-white text-sm">
                        <span>Başarısız giriş denemesi: {loginAttempts}/{maxLoginAttempts}</span>
                        <span className="text-red-300">{loginTimeout}s</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginAttempts >= maxLoginAttempts || loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Giriş Yapılıyor...
                      </span>
                    ) : (
                      'Güvenli Giriş'
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <div className="flex items-center justify-center space-x-4 text-white/50 text-sm">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                      <span>SSL Şifreli</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      <span>Güvenli</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-screen">
            <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-white">Gardiyan Admin</h1>
                      <p className="text-white/70 text-sm">Lisans Yönetim Paneli</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-white text-sm">Son Aktivite: {lastActivity}</p>
                      <p className="text-white/70 text-xs">IP: {userIP}</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {userInitials}
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition border border-white/20"
                    >
                      Çıkış
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">Toplam Lisans</p>
                      <p className="text-3xl font-bold text-white mt-2">{stats.total}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">Aktif Lisans</p>
                      <p className="text-3xl font-bold text-green-400 mt-2">{stats.active}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">Pasif Lisans</p>
                      <p className="text-3xl font-bold text-red-400 mt-2">{stats.inactive}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">Son 7 Gün</p>
                      <p className="text-3xl font-bold text-purple-400 mt-2">{stats.recent}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                  <div className="flex items-center space-x-4">
                    <div className="relative flex-1 sm:flex-none">
                      <input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        type="text"
                        placeholder="Lisans ara..."
                        className="w-full sm:w-80 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      />
                      <svg className="absolute right-3 top-2.5 w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                      </svg>
                    </div>
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    >
                      <option value="all">Tüm Durumlar</option>
                      <option value="active">Aktif</option>
                      <option value="inactive">Pasif</option>
                    </select>
                  </div>

                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span>Yeni Lisans</span>
                  </button>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Lisans Anahtarı</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Durum</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Oluşturulma</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Son Aktivite</th>
                        <th className="px-6 py-4 text-right text-sm font-semibold text-white/70">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredLicenses.map(license => (
                        <tr key={license.id} className="hover:bg-white/5 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className={`w-2 h-2 ${license.is_active ? 'bg-green-400' : 'bg-red-400'} rounded-full`}></div>
                              <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded">{license.key}</code>
                              <button 
                                onClick={() => copyToClipboard(license.key)} 
                                className="text-white/50 hover:text-white transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              license.is_active 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {license.is_active ? 'Aktif' : 'Pasif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-white/70 text-sm">{formatDate(license.created_at)}</td>
                          <td className="px-6 py-4 text-white/70 text-sm">{formatDate(license.updated_at)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button 
                                onClick={() => toggleLicense(license)}
                                className={`text-white px-3 py-1 rounded-lg text-sm transition ${
                                  license.is_active 
                                    ? 'bg-orange-500 hover:bg-orange-600' 
                                    : 'bg-green-500 hover:bg-green-600'
                                }`}
                              >
                                {license.is_active ? 'Pasif Et' : 'Aktif Et'}
                              </button>
                              <button 
                                onClick={() => deleteLicense(license.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition"
                              >
                                Sil
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredLicenses.length === 0 && (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-white/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p className="text-white/50 text-lg">Lisans bulunamadı</p>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-white/20 max-w-md w-full">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">Yeni Lisans Ekle</h3>
            </div>
            <form onSubmit={addLicense} className="p-6">
              <div className="mb-4">
                <label className="block text-white text-sm font-medium mb-2">Lisans Anahtarı</label>
                <input 
                  value={newLicense.key}
                  onChange={(e) => handleNewLicenseChange(e.target.value)}
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Lisans anahtarını girin"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-white/70 hover:text-white transition"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
                >
                  {loading ? 'Ekleniyor...' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 border border-white/20">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="text-white">İşlem yapılıyor...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;