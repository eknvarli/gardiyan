<script>
    import { onMount } from 'svelte';
    
    let API_BASE = 'http://127.0.0.1:8000/api';
    let isAuthenticated = false;
    let loading = false;
    let credentials = {
        username: '',
        password: ''
    };
    let showPassword = false;
    let loginAttempts = 0;
    let maxLoginAttempts = 5;
    let loginTimeout = 0;
    let licenses = [];
    let searchQuery = '';
    let statusFilter = 'all';
    let showAddModal = false;
    let newLicense = {
        key: '',
        author: 1,
    };
    let userIP = '192.168.1.1';
    let lastActivity = new Date().toLocaleTimeString('tr-TR');
    let sessionTimeoutWarning = false;
    let sessionTimeLeft = 300;
    let securityAlert = {
        show: false,
        title: '',
        message: ''
    };
    let stats = {
        total: 0,
        active: 0,
        inactive: 0,
        recent: 0
    };
    
    $: filteredLicenses = (() => {
        let filtered = licenses;
        if (searchQuery) {
            filtered = filtered.filter(license => 
                license.key.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        if (statusFilter !== 'all') {
            const isActive = statusFilter === 'active';
            filtered = filtered.filter(license => license.is_active === isActive);
        }
        return filtered;
    })();
    
    $: userInitials = credentials.username ? credentials.username.charAt(0).toUpperCase() : 'A';
    
    onMount(() => {
        detectIP();
        const token = localStorage.getItem('authToken');
        if (token) {
            isAuthenticated = true;
            fetchLicenses();
            startSessionTimer();
            startActivityTracker();
        }
    });
    
    function detectIP() {
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                userIP = data.ip;
            })
            .catch(() => {
                userIP = '127.0.0.1';
            });
    }
    
    async function handleLogin() {
        if (loginAttempts >= maxLoginAttempts) {
            showSecurityAlert('Güvenlik Kilidi', 'Çok fazla başarısız giriş denemesi. Lütfen 5 dakika bekleyin.');
            return;
        }
    
        loading = true;
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
                isAuthenticated = true;
                loginAttempts = 0;
                await fetchLicenses();
                startSessionTimer();
                startActivityTracker();
            } else {
                loginAttempts++;
                if (loginAttempts >= maxLoginAttempts) {
                    startLoginTimeout();
                }
                showSecurityAlert('Giriş Başarısız', data.error || 'Kullanıcı adı veya şifre hatalı.');
            }
        } catch (err) {
            loginAttempts++;
            showSecurityAlert('Bağlantı Hatası', 'Sunucuya bağlanılamadı. Lütfen CORS ayarlarını kontrol edin.');
            console.error('Login error:', err);
        } finally {
            loading = false;
        }
    }
    
    function startLoginTimeout() {
        loginTimeout = 300;
        const interval = setInterval(() => {
            loginTimeout--;
            if (loginTimeout <= 0) {
                clearInterval(interval);
                loginAttempts = 0;
            }
        }, 1000);
    }
    
    function startSessionTimer() {
        setInterval(() => {
            sessionTimeLeft--;
            if (sessionTimeLeft <= 60) {
                sessionTimeoutWarning = true;
            }
            if (sessionTimeLeft <= 0) {
                handleLogout();
            }
        }, 1000);
    }
    
    function startActivityTracker() {
        document.addEventListener('mousemove', resetSessionTimer);
        document.addEventListener('keypress', resetSessionTimer);
        document.addEventListener('click', resetSessionTimer);
    }
    
    function resetSessionTimer() {
        sessionTimeLeft = 300;
        lastActivity = new Date().toLocaleTimeString('tr-TR');
        sessionTimeoutWarning = false;
    }
    
    async function fetchLicenses() {
        loading = true;
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
                licenses = data;
                calculateStats();
            } else if (response.status === 401) {
                handleLogout();
                showSecurityAlert('Oturum Süresi Doldu', 'Lütfen tekrar giriş yapın.');
            }
        } catch (err) {
            showSecurityAlert('Veri Hatası', 'Lisanslar yüklenirken hata oluştu.');
            console.error('Fetch licenses error:', err);
        } finally {
            loading = false;
        }
    }
    
    function calculateStats() {
        stats.total = licenses.length;
        stats.active = licenses.filter(l => l.is_active).length;
        stats.inactive = licenses.filter(l => !l.is_active).length;
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        stats.recent = licenses.filter(l => new Date(l.created_at) > weekAgo).length;
    }
    
    async function addLicense() {
        loading = true;
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
                showAddModal = false;
                newLicense.key = '';
                await fetchLicenses();
            } else {
                const error = await response.json();
                showSecurityAlert('Hata', error.detail || 'Lisans eklenirken hata oluştu.');
            }
        } catch (err) {
            showSecurityAlert('Bağlantı Hatası', 'Sunucuya bağlanılamadı.');
            console.error('Add license error:', err);
        } finally {
            loading = false;
        }
    }
    
    async function toggleLicense(license) {
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
    }
    
    async function deleteLicense(licenseId) {
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
    }
    
    function handleLogout() {
        localStorage.removeItem('authToken');
        isAuthenticated = false;
        credentials.username = '';
        credentials.password = '';
        sessionTimeoutWarning = false;
        sessionTimeLeft = 300;
    }
    
    function showSecurityAlert(title, message) {
        securityAlert = {
            show: true,
            title,
            message
        };
    }
    
    function dismissSecurityAlert() {
        securityAlert.show = false;
    }
    
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text);
    }
    
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('tr-TR');
    }
</script>

<svelte:head>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 font-inter">
    <div class="absolute inset-0 overflow-hidden">
        <div class="absolute -inset-10 opacity-20">
            <div class="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
            <div class="absolute top-1/3 right-1/4 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style="animation-delay: 2s"></div>
            <div class="absolute bottom-1/4 left-1/2 w-64 h-64 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style="animation-delay: 4s"></div>
        </div>
    </div>

    {#if securityAlert.show}
        <div class="fixed inset-0 bg-red-900 bg-opacity-90 z-50 flex items-center justify-center">
            <div class="bg-white p-8 rounded-2xl shadow-2xl max-w-md mx-4">
                <div class="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                    <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-gray-900 text-center mb-2">{securityAlert.title}</h3>
                <p class="text-gray-600 text-center mb-6">{securityAlert.message}</p>
                <button on:click={dismissSecurityAlert} class="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                    Tamam
                </button>
            </div>
        </div>
    {/if}

    {#if sessionTimeoutWarning}
        <div class="fixed top-4 right-4 bg-orange-500 text-white p-4 rounded-lg shadow-lg z-40">
            <div class="flex items-center space-x-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Oturum süresi dolmak üzere: {sessionTimeLeft}s</span>
            </div>
        </div>
    {/if}

    <div class="relative z-10">
        {#if !isAuthenticated}
            <div class="min-h-screen flex items-center justify-center p-4">
                <div class="max-w-md w-full">
                    <div class="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
                        <div class="text-center mb-8">
                            <div class="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                                <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                </svg>
                            </div>
                            <h1 class="text-3xl font-bold text-white mb-2">Gardiyan</h1>
                            <p class="text-white/70">Yüksek Güvenlikli Lisans Yönetimi</p>
                        </div>

                        <form on:submit|preventDefault={handleLogin} class="space-y-6">
                            <div>
                                <label class="block text-white text-sm font-medium mb-2">Kullanıcı Adı</label>
                                <div class="relative">
                                    <input 
                                        bind:value={credentials.username}
                                        type="text"
                                        required
                                        disabled={loginAttempts >= maxLoginAttempts}
                                        class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
                                        placeholder="admin"
                                    />
                                    <div class="absolute right-3 top-3">
                                        <svg class="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label class="block text-white text-sm font-medium mb-2">Şifre</label>
                                <div class="relative">
                                    <input 
										value={credentials.password}
										on:input={(e) => credentials.password = e.target.value}
										type={showPassword ? 'text' : 'password'}
										required
										disabled={loginAttempts >= maxLoginAttempts}
										class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
										placeholder="••••••••"
									/>
                                    <button 
                                        type="button"
                                        on:click={() => showPassword = !showPassword}
                                        class="absolute right-3 top-3 text-white/50 hover:text-white transition"
                                    >
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {#if showPassword}
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                            {:else}
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                                            {/if}
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {#if loginAttempts > 0}
                                <div class="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                                    <div class="flex items-center justify-between text-white text-sm">
                                        <span>Başarısız giriş denemesi: {loginAttempts}/{maxLoginAttempts}</span>
                                        <span class="text-red-300">{loginTimeout}s</span>
                                    </div>
                                </div>
                            {/if}

                            <button
                                type="submit"
                                disabled={loginAttempts >= maxLoginAttempts || loading}
                                class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {#if loading}
                                    <span class="flex items-center justify-center">
                                        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Giriş Yapılıyor...
                                    </span>
                                {:else}
                                    Güvenli Giriş
                                {/if}
                            </button>
                        </form>

                        <div class="mt-6 text-center">
                            <div class="flex items-center justify-center space-x-4 text-white/50 text-sm">
                                <div class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                                    </svg>
                                    <span>SSL Şifreli</span>
                                </div>
                                <div class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                    </svg>
                                    <span>Güvenli</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {:else}
            <div class="min-h-screen">
                <header class="bg-white/10 backdrop-blur-lg border-b border-white/20">
                    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div class="flex justify-between items-center py-4">
                            <div class="flex items-center space-x-3">
                                <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h1 class="text-xl font-bold text-white">Gardiyan Admin</h1>
                                    <p class="text-white/70 text-sm">Lisans Yönetim Paneli</p>
                                </div>
                            </div>

                            <div class="flex items-center space-x-4">
                                <div class="text-right">
                                    <p class="text-white text-sm">Son Aktivite: {lastActivity}</p>
                                    <p class="text-white/70 text-xs">IP: {userIP}</p>
                                </div>
                                <div class="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                                    {userInitials}
                                </div>
                                <button 
                                    on:click={handleLogout}
                                    class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition border border-white/20"
                                >
                                    Çıkış
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-white/70 text-sm">Toplam Lisans</p>
                                    <p class="text-3xl font-bold text-white mt-2">{stats.total}</p>
                                </div>
                                <div class="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-white/70 text-sm">Aktif Lisans</p>
                                    <p class="text-3xl font-bold text-green-400 mt-2">{stats.active}</p>
                                </div>
                                <div class="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-white/70 text-sm">Pasif Lisans</p>
                                    <p class="text-3xl font-bold text-red-400 mt-2">{stats.inactive}</p>
                                </div>
                                <div class="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-white/70 text-sm">Son 7 Gün</p>
                                    <p class="text-3xl font-bold text-purple-400 mt-2">{stats.recent}</p>
                                </div>
                                <div class="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
                        <div class="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                            <div class="flex items-center space-x-4">
                                <div class="relative flex-1 sm:flex-none">
                                    <input 
                                        bind:value={searchQuery}
                                        type="text"
                                        placeholder="Lisans ara..."
                                        class="w-full sm:w-80 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    />
                                    <svg class="absolute right-3 top-2.5 w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                    </svg>
                                </div>
                                <select 
                                    bind:value={statusFilter}
                                    class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                >
                                    <option value="all">Tüm Durumlar</option>
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Pasif</option>
                                </select>
                            </div>

                            <button 
                                on:click={() => showAddModal = true}
                                class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition flex items-center space-x-2"
                            >
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                </svg>
                                <span>Yeni Lisans</span>
                            </button>
                        </div>
                    </div>

                    <div class="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead>
                                    <tr class="border-b border-white/10">
                                        <th class="px-6 py-4 text-left text-sm font-semibold text-white/70">Lisans Anahtarı</th>
                                        <th class="px-6 py-4 text-left text-sm font-semibold text-white/70">Durum</th>
                                        <th class="px-6 py-4 text-left text-sm font-semibold text-white/70">Oluşturulma</th>
                                        <th class="px-6 py-4 text-left text-sm font-semibold text-white/70">Son Aktivite</th>
                                        <th class="px-6 py-4 text-right text-sm font-semibold text-white/70">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-white/10">
                                    {#each filteredLicenses as license (license.id)}
                                        <tr class="hover:bg-white/5 transition">
                                            <td class="px-6 py-4">
                                                <div class="flex items-center space-x-3">
                                                    <div class="w-2 h-2 {license.is_active ? 'bg-green-400' : 'bg-red-400'} rounded-full"></div>
                                                    <code class="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded">{license.key}</code>
                                                    <button on:click={() => copyToClipboard(license.key)} class="text-white/50 hover:text-white transition">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                            <td class="px-6 py-4">
                                                <span class="px-3 py-1 rounded-full text-xs font-medium {license.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                                                    {license.is_active ? 'Aktif' : 'Pasif'}
                                                </span>
                                            </td>
                                            <td class="px-6 py-4 text-white/70 text-sm">{formatDate(license.created_at)}</td>
                                            <td class="px-6 py-4 text-white/70 text-sm">{formatDate(license.updated_at)}</td>
                                            <td class="px-6 py-4 text-right">
                                                <div class="flex items-center justify-end space-x-2">
                                                    <button 
                                                        on:click={() => toggleLicense(license)}
                                                        class="text-white px-3 py-1 rounded-lg text-sm transition {license.is_active ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}"
                                                    >
                                                        {license.is_active ? 'Pasif Et' : 'Aktif Et'}
                                                    </button>
                                                    <button 
                                                        on:click={() => deleteLicense(license.id)}
                                                        class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition"
                                                    >
                                                        Sil
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>

                        {#if filteredLicenses.length === 0}
                            <div class="text-center py-12">
                                <svg class="w-16 h-16 text-white/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                <p class="text-white/50 text-lg">Lisans bulunamadı</p>
                            </div>
                        {/if}
                    </div>
                </main>
            </div>
        {/if}
    </div>

    {#if showAddModal}
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div class="bg-slate-800 rounded-2xl shadow-2xl border border-white/20 max-w-md w-full">
                <div class="p-6 border-b border-white/10">
                    <h3 class="text-xl font-semibold text-white">Yeni Lisans Ekle</h3>
                </div>
                <form on:submit|preventDefault={addLicense} class="p-6">
                    <div class="mb-4">
                        <label class="block text-white text-sm font-medium mb-2">Lisans Anahtarı</label>
                        <input 
                            bind:value={newLicense.key}
                            type="text"
                            required
                            class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            placeholder="Lisans anahtarını girin"
                        />
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button 
                            type="button"
                            on:click={() => showAddModal = false}
                            class="px-4 py-2 text-white/70 hover:text-white transition"
                        >
                            İptal
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
                        >
                            {loading ? 'Ekleniyor...' : 'Ekle'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}

    {#if loading}
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div class="bg-slate-800 rounded-2xl p-6 border border-white/20">
                <div class="flex items-center space-x-3">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span class="text-white">İşlem yapılıyor...</span>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .font-inter {
        font-family: 'Inter', sans-serif;
    }
</style>