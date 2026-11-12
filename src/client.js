window.__ModuleLoader__.load({
  id: '@winterhuan/dsh-new-api',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    /* ------------------------------------------------------------------ *
     * Locale dictionaries (zh is the primary user language)
     * ------------------------------------------------------------------ */
    const zh = {
      nav: 'New API 管理台',
      title: 'New API 管理台',
      subtitle: '管理 New API 公益站，查看每日签到状态与剩余额度，并在设定时间自动签到。',
      autoSectionTitle: '每日自动签到',
      autoSectionDesc: '到达设定时间后，Harness 会在后台为所有启用且参与自动签到的站点执行签到。',
      autoCheckInLabel: '自动签到',
      autoCheckInOffNote: '自动签到已关闭；下方的时间与随机延迟会在重新开启后生效，手动签到不受影响。',
      dailyTimeLabel: '每日签到时间',
      dailyTimeHint: '24 小时制，使用本机时区。',
      jitterLabel: '随机延迟',
      jitterHint: '在设定时间后叠加 0 到该值之间的随机延迟，避免同时请求。',
      jitterNone: '不延迟',
      minutesUnit: '分钟',
      saveSettings: '保存设置',
      savingSettings: '保存中…',
      settingsSaved: '设置已保存',
      settingsSaveFailed: '保存设置失败：',
      settingsUnsaved: '有未保存的修改',
      errorTimeInvalid: '请填写有效的签到时间（HH:MM）',
      toolbarRefresh: '刷新',
      toolbarCheckAll: '全部签到',
      toolbarCheckingAll: '正在签到…',
      toolbarAdd: '添加站点',
      loading: '正在加载…',
      loadFailed: '加载失败：',
      retry: '重试',
      emptyTitle: '还没有添加公益站',
      emptyLine1: '点击「添加站点」，填写站点地址与登录 Cookie 即可开始。',
      emptyLine2: '新版站（如 api.ark717.com）：在站点后台「个人设置 → 访问令牌」创建 Bearer 令牌。旧版站：浏览器开发者工具 → 应用/存储 → Cookies 复制 session。',
      emptyLine3: '旧版站还需要 New-Api-User 请求头，请在编辑表单中填写用户 ID。',
      statusPending: '今日未签到',
      statusSuccess: '今日已签到',
      statusAlready: '今日已签到',
      statusManual: '需人工验证',
      statusSkipped: '已跳过',
      statusFailed: '签到失败',
      statusDisabled: '已停用',
      enabledLabel: '启用',
      autoTag: '自动签到',
      quotaRemaining: '剩余额度',
      quotaUsed: '已用',
      quotaUnknown: '额度未知',
      quotaUnit: '额度',
      walletLabel: '签到余额',
      walletHint: '签到余额仅在站点 default / 原始用户分组 下消费；其他分组扣当前余额',
      lastCheckInLabel: '最近签到',
      noCheckIn: '暂无签到记录',
      checkIn: '签到',
      checkingIn: '签到中…',
      refresh: '刷新',
      refreshing: '刷新中…',
      edit: '编辑',
      remove: '删除',
      deleting: '删除中…',
      deleteConfirm: '确定删除该站点？',
      deleteFailed: '删除失败：',
      siteDeleted: '站点已删除',
      toggleFailed: '切换启用状态失败：',
      siteEnabled: '站点已启用',
      siteDisabled: '站点已停用',
      checkInFailedPrefix: '签到失败：',
      flashCheckIn: '签到完成',
      flashCheckInAll: '全部站点签到完成',
      flashCheckInAllFailures: '批量签到完成，失败站点数：',
      flashRefreshAll: '站点状态已刷新',
      refreshFailed: '刷新失败：',
      checkAllFailed: '批量签到失败：',
      flashRefreshSite: '额度已刷新',
      flashSiteAdded: '站点已添加',
      flashSiteSaved: '站点已保存',
      addTitle: '添加站点',
      editTitle: '编辑站点',
      formName: '名称',
      formNamePlaceholder: '例如：某某公益站（可选）',
      formBaseUrl: '站点地址',
      formBaseUrlPlaceholder: 'https://api.example.com',
      formCookie: 'Cookie',
      formCookiePlaceholder: 'session=...',
      formCookieStored: '已保存 Cookie（留空保持不变）',
      formCookieHint: '旧版站点：浏览器开发者工具 → 应用/存储 → Cookies 中 session 的值。',
      authModeLabel: '认证方式',
      authBearer: 'Bearer 访问令牌',
      authCookie: 'session Cookie',
      authBearerShort: 'Bearer',
      authCookieShort: 'Cookie',
      formToken: '访问令牌 Token',
      formTokenPlaceholder: 'sk-...',
      formTokenStored: '已保存令牌（留空保持不变）',
      formTokenHint: '在站点后台「个人设置 → 访问令牌」创建 PAT 后粘贴（新版 New API / 如 api.ark717.com 用这种方式）。',
      authHelp: '新版站（如 api.ark717.com）用 Bearer 令牌；旧版站用 session Cookie + 用户 ID。',
      statusUnsupported: '站点未开启签到',
      flashCheckInUnsupported: '站点未开启签到',
      flashCheckInManual: '站点启用了 Turnstile，请在浏览器手动签到后点刷新',
      flashCheckInAlready: '今日已签到',
      flashCheckInAwarded: '获得额度',
      flashCheckInAllManual: '批量签到需要人工验证的站点数：',
      authMissing: '凭据缺失：请编辑站点填写访问令牌或 Cookie',
      badgeTurnstile: '需人工验证',
      badgeNoCredential: '缺少凭据',
      attemptsLabel: '尝试次数',
      errorTokenRequired: '请填写访问令牌',
      formUserId: '用户 ID',
      formUserIdPlaceholder: '例如：12345',
      formUserIdHint: '旧版站点必需，可从 /api/user/self 或个人设置页 URL 获取。',
      formCheckInPath: '签到路径（可选）',
      formCheckInPathPlaceholder: '/api/user/sign_in',
      formCheckInPathHint: '留空则使用站点默认签到接口。',
      formAutoCheckIn: '参与自动签到',
      formSubmitAdd: '添加',
      formSubmitSave: '保存',
      formSaving: '保存中…',
      formCancel: '取消',
      errorBaseUrlRequired: '请填写站点地址',
      errorBaseUrlInvalid: '站点地址需以 http:// 或 https:// 开头',
      errorCookieRequired: '请填写 Cookie',
      errorUserIdInvalid: '用户 ID 必须是数字',
      formSaveFailed: '保存失败：',
      enableSiteAria: '启用站点',
    };

    const en = {
      nav: 'New API console',
      title: 'New API console',
      subtitle: 'Manage New API relay sites, inspect daily check-in status and remaining quota, and check in automatically at the scheduled time.',
      autoSectionTitle: 'Daily auto check-in',
      autoSectionDesc: 'At the scheduled time, Harness checks in every enabled site that participates in auto check-in.',
      autoCheckInLabel: 'Auto check-in',
      autoCheckInOffNote: 'Auto check-in is off; the time and jitter below apply when you turn it back on. Manual check-in still works.',
      dailyTimeLabel: 'Daily check-in time',
      dailyTimeHint: '24-hour local time.',
      jitterLabel: 'Random jitter',
      jitterHint: 'Adds a random delay of 0 to this many minutes after the scheduled time.',
      jitterNone: 'None',
      minutesUnit: 'min',
      saveSettings: 'Save settings',
      savingSettings: 'Saving…',
      settingsSaved: 'Settings saved',
      settingsSaveFailed: 'Failed to save settings: ',
      settingsUnsaved: 'Unsaved changes',
      errorTimeInvalid: 'Enter a valid check-in time (HH:MM)',
      toolbarRefresh: 'Refresh',
      toolbarCheckAll: 'Check in all',
      toolbarCheckingAll: 'Checking in…',
      toolbarAdd: 'Add site',
      loading: 'Loading…',
      loadFailed: 'Failed to load: ',
      retry: 'Retry',
      emptyTitle: 'No sites yet',
      emptyLine1: 'Click “Add site”, then enter the site address and your login cookie to get started.',
      emptyLine2: 'Newer sites (e.g. api.ark717.com): create a Bearer token under Settings → Access tokens in the site dashboard. Older sites: copy the session value from the browser developer tools → Application/Storage → Cookies.',
      emptyLine3: 'Older sites also need a New-Api-User header; fill in the user ID in the edit form.',
      statusPending: 'Not checked in today',
      statusSuccess: 'Checked in today',
      statusAlready: 'Checked in today',
      statusManual: 'Manual check-in needed',
      statusSkipped: 'Skipped',
      statusFailed: 'Check-in failed',
      statusDisabled: 'Disabled',
      enabledLabel: 'Enabled',
      autoTag: 'Auto',
      quotaRemaining: 'Remaining',
      quotaUsed: 'Used',
      quotaUnknown: 'Quota unavailable',
      quotaUnit: 'quota',
      walletLabel: 'Check-in balance',
      walletHint: 'Spendable only through the site default / original user group; other groups bill the main balance.',
      lastCheckInLabel: 'Last check-in',
      noCheckIn: 'No check-in yet',
      checkIn: 'Check in',
      checkingIn: 'Checking in…',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      edit: 'Edit',
      remove: 'Delete',
      deleting: 'Deleting…',
      deleteConfirm: 'Remove this site?',
      deleteFailed: 'Failed to remove: ',
      siteDeleted: 'Site removed',
      toggleFailed: 'Failed to toggle the site: ',
      siteEnabled: 'Site enabled',
      siteDisabled: 'Site disabled',
      checkInFailedPrefix: 'Check-in failed: ',
      flashCheckIn: 'Check-in finished',
      flashCheckInAll: 'All sites checked in',
      flashCheckInAllFailures: 'Batch check-in finished; failed sites: ',
      flashRefreshAll: 'Sites refreshed',
      refreshFailed: 'Failed to refresh: ',
      checkAllFailed: 'Batch check-in failed: ',
      flashRefreshSite: 'Quota refreshed',
      flashSiteAdded: 'Site added',
      flashSiteSaved: 'Site saved',
      addTitle: 'Add site',
      editTitle: 'Edit site',
      formName: 'Name',
      formNamePlaceholder: 'e.g. My relay (optional)',
      formBaseUrl: 'Site address',
      formBaseUrlPlaceholder: 'https://api.example.com',
      formCookie: 'Cookie',
      formCookiePlaceholder: 'session=...',
      formCookieStored: 'Cookie saved (leave blank to keep it)',
      formCookieHint: 'Older sites: the value of the session cookie from the browser developer tools → Application/Storage → Cookies.',
      authModeLabel: 'Authentication',
      authBearer: 'Bearer access token',
      authCookie: 'session cookie',
      authBearerShort: 'Bearer',
      authCookieShort: 'Cookie',
      formToken: 'Access token',
      formTokenPlaceholder: 'sk-...',
      formTokenStored: 'Token saved (leave blank to keep it)',
      formTokenHint: 'Create a PAT under Settings → Access tokens in the site dashboard and paste it here (newer New API versions, e.g. api.ark717.com).',
      authHelp: 'Newer sites (e.g. api.ark717.com) use a Bearer token; older sites use a session cookie plus user ID.',
      statusUnsupported: 'Check-in unavailable',
      flashCheckInUnsupported: 'Check-in is not enabled on this site',
      flashCheckInManual: 'This site uses Turnstile; check in manually in the browser, then refresh',
      flashCheckInAlready: 'Already checked in today',
      flashCheckInAwarded: 'Awarded',
      flashCheckInAllManual: 'Sites needing manual check-in: ',
      authMissing: 'Credentials missing: edit this site to add a token or cookie',
      badgeTurnstile: 'Manual verification',
      badgeNoCredential: 'No credentials',
      attemptsLabel: 'Attempts',
      errorTokenRequired: 'Access token is required',
      formUserId: 'User ID',
      formUserIdPlaceholder: 'e.g. 12345',
      formUserIdHint: 'Required by older sites; find it in /api/user/self or your profile page URL.',
      formCheckInPath: 'Check-in path (optional)',
      formCheckInPathPlaceholder: '/api/user/sign_in',
      formCheckInPathHint: 'Leave blank to use the site default.',
      formAutoCheckIn: 'Include in auto check-in',
      formSubmitAdd: 'Add',
      formSubmitSave: 'Save',
      formSaving: 'Saving…',
      formCancel: 'Cancel',
      errorBaseUrlRequired: 'Site address is required',
      errorBaseUrlInvalid: 'Site address must start with http:// or https://',
      errorCookieRequired: 'Cookie is required',
      errorUserIdInvalid: 'User ID must be numeric',
      formSaveFailed: 'Failed to save: ',
      enableSiteAria: 'Enable site',
    };

    /* ------------------------------------------------------------------ *
     * Host bridge
     * ------------------------------------------------------------------ */
    const API = new URL('dsh-new-api/api', document.baseURI).toString();

    async function call(action, payload) {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-DSH-New-API': '1' },
        body: JSON.stringify({ action, payload: payload == null ? null : payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok !== true) {
        throw new Error((data && data.error) || ('HTTP ' + res.status));
      }
      return data.data;
    }

    function errText(err) {
      if (err == null) return 'Unknown error';
      if (typeof err === 'string') return err;
      return err.message || String(err);
    }

    /* ------------------------------------------------------------------ *
     * Small pure helpers
     * ------------------------------------------------------------------ */
    const usdFormat = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });

    const cnyFormat = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CNY',
      maximumFractionDigits: 2,
    });

    const plainNumberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

    function plainNumber(value) {
      if (typeof value !== 'number' || !isFinite(value)) return '-';
      try {
        return plainNumberFormat.format(value);
      } catch (_) {
        return String(value);
      }
    }

    function customAmount(value, symbol) {
      const text = plainNumber(value);
      return symbol ? text + ' ' + symbol : text;
    }

    function money(value) {
      if (typeof value !== 'number' || !isFinite(value)) return '-';
      try {
        return usdFormat.format(value);
      } catch (_) {
        return '$' + value.toFixed(2);
      }
    }

    function moneyCny(value) {
      if (typeof value !== 'number' || !isFinite(value)) return '-';
      try {
        return cnyFormat.format(value);
      } catch (_) {
        return '¥' + value.toFixed(2);
      }
    }

    function formatDateTime(iso) {
      try {
        const date = new Date(iso);
        if (!isFinite(date.getTime())) return '';
        return new Intl.DateTimeFormat(undefined, {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date);
      } catch (_) {
        return '';
      }
    }

    function hostOf(baseUrl) {
      try {
        return new URL(baseUrl).host;
      } catch (_) {
        return '';
      }
    }

    function siteName(site) {
      const name = site && typeof site.name === 'string' ? site.name.trim() : '';
      if (name) return name;
      const host = hostOf(site && site.baseUrl);
      if (host) return host;
      return (site && site.baseUrl) || '';
    }

    function profileUrl(baseUrl) {
      const base = typeof baseUrl === 'string' ? baseUrl : '';
      return base.replace(/\/+$/, '') + '/profile';
    }

    function jitterOptions(current) {
      const base = [0, 15, 30, 60, 120];
      const value = typeof current === 'number' && isFinite(current) ? current : 0;
      if (base.indexOf(value) >= 0) return base;
      return base.concat([value]).sort((a, b) => a - b);
    }

    function toDraft(settings) {
      const source = settings || {};
      const jitter = Number(source.jitterMinutes);
      return {
        autoCheckInEnabled: !!source.autoCheckInEnabled,
        dailyTime: typeof source.dailyTime === 'string' && /^\d{2}:\d{2}$/.test(source.dailyTime)
          ? source.dailyTime
          : '09:00',
        jitterMinutes: isFinite(jitter) && jitter >= 0 ? jitter : 0,
      };
    }

    function sameDraft(a, b) {
      return !!a && !!b
        && a.autoCheckInEnabled === b.autoCheckInEnabled
        && a.dailyTime === b.dailyTime
        && a.jitterMinutes === b.jitterMinutes;
    }

    function statusMeta(status, t) {
      switch (status) {
        case 'success':
          return { label: t('statusSuccess'), cls: 'nm-pill--success' };
        case 'already':
          return { label: t('statusAlready'), cls: 'nm-pill--success' };
        case 'manual':
          return { label: t('statusManual'), cls: 'nm-pill--warn' };
        case 'unsupported':
          return { label: t('statusUnsupported'), cls: 'nm-pill--idle' };
        case 'skipped':
          return { label: t('statusSkipped'), cls: 'nm-pill--idle' };
        case 'failed':
          return { label: t('statusFailed'), cls: 'nm-pill--error' };
        case 'disabled':
          return { label: t('statusDisabled'), cls: 'nm-pill--idle' };
        default:
          return { label: t('statusPending'), cls: 'nm-pill--warn' };
      }
    }

    function quotaText(quota, t) {
      if (!quota) return t('quotaUnknown');
      let remaining = '-';
      if (quota.currency === 'CUSTOM' && quota.custom != null) {
        remaining = customAmount(Number(quota.custom), quota.symbol || '');
      } else if (quota.currency === 'CNY' && quota.cny != null) {
        remaining = moneyCny(Number(quota.cny));
      } else if (quota.usd != null) {
        remaining = money(Number(quota.usd));
        if (quota.cny != null) remaining += ' / ' + moneyCny(Number(quota.cny));
      } else if (quota.remaining != null) {
        remaining = String(quota.remaining) + ' ' + t('quotaUnit');
      }
      let used = '-';
      if (quota.currency === 'CUSTOM' && quota.usedCustom != null) {
        used = customAmount(Number(quota.usedCustom), quota.symbol || '');
      } else if (quota.currency === 'CNY' && quota.usedCny != null) {
        used = moneyCny(Number(quota.usedCny));
      } else if (quota.used != null) {
        if (quota.quotaPerUnit != null && Number(quota.quotaPerUnit) > 0) {
          used = money(Number(quota.used) / Number(quota.quotaPerUnit));
        } else {
          used = String(quota.used) + ' ' + t('quotaUnit');
        }
      }
      return t('quotaRemaining') + ': ' + remaining + ' · ' + t('quotaUsed') + ': ' + used;
    }

    function walletText(quota, t) {
      if (!quota || !quota.wallet) return null;
      const wallet = quota.wallet;
      let amount = '-';
      if (wallet.currency === 'CUSTOM' && wallet.custom != null) {
        amount = customAmount(Number(wallet.custom), wallet.symbol || '');
      } else if (wallet.currency === 'CNY' && wallet.cny != null) {
        amount = moneyCny(Number(wallet.cny));
      } else if (wallet.usd != null) {
        amount = money(Number(wallet.usd));
      } else {
        amount = String(wallet.remaining) + ' ' + t('quotaUnit');
      }
      return t('walletLabel') + ': ' + amount;
    }

    function lastCheckInText(site, t) {
      const last = site && site.lastCheckIn;
      if (!last) return t('noCheckIn');
      const parts = [t('lastCheckInLabel') + ': '];
      const isFailed = site.todayStatus === 'failed';
      if (!isFailed && last.message) parts.push(last.message);
      else parts.push(statusMeta(last.status, t).label);
      if (last.attempts != null && last.attempts > 1) parts.push(t('attemptsLabel') + ' ' + last.attempts);
      const when = last.at ? formatDateTime(last.at) : '';
      if (when) parts.push(when);
      return parts.join(' ');
    }

    function authText(site, t) {
      if (!site) return '';
      if (!site.hasToken && !site.hasCookie) return t('authMissing');
      const isCookie = site.authMode === 'cookie';
      const mode = isCookie ? t('authCookieShort') : t('authBearerShort');
      const masked = isCookie ? site.cookieMasked : site.tokenMasked;
      return t('authModeLabel') + ': ' + mode + (masked ? ' · ' + masked : '');
    }

    function useFlash() {
      const [flash, setFlash] = useState(null);
      useEffect(() => {
        if (!flash) return undefined;
        const timer = setTimeout(() => setFlash(null), 3000);
        return () => clearTimeout(timer);
      }, [flash]);
      return [flash, setFlash];
    }

    /* ------------------------------------------------------------------ *
     * Controls
     * ------------------------------------------------------------------ */
    function Switch({ checked, onChange, disabled, ariaLabel }) {
      function toggle() {
        if (!disabled) onChange(!checked);
      }
      function handleKeyDown(event) {
        if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
          event.preventDefault();
          toggle();
        }
      }
      return h('div', {
        className: 'nm-switch' + (checked ? ' nm-switch--on' : '') + (disabled ? ' nm-switch--disabled' : ''),
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        'aria-disabled': disabled ? 'true' : 'false',
        'aria-label': ariaLabel,
        tabIndex: disabled ? -1 : 0,
        onClick: toggle,
        onKeyDown: handleKeyDown,
      }, h('span', { className: 'nm-switch-knob', 'aria-hidden': true }));
    }

    function SiteCard({ t, site, busy, onCheckIn, onRefresh, onEdit, onDelete, onToggle }) {
      const name = siteName(site);
      const status = statusMeta(site.todayStatus, t);
      const isBusy = !!busy;
      const info = site.info || null;
      const needsCredential = !site.hasToken && !site.hasCookie;
      const infoLine = info
        ? [info.systemName, info.version ? (/^v/i.test(info.version) ? info.version : 'v' + info.version) : ''].filter(Boolean).join(' · ')
        : '';
      const failedMessage = site.todayStatus === 'failed' && site.lastCheckIn && site.lastCheckIn.message
        ? site.lastCheckIn.message
        : '';

      return h('article', { className: 'nm-card nm-site' },
        h('div', { className: 'nm-site-head' },
          h('div', { className: 'nm-site-title-wrap' },
            h('h4', { className: 'nm-site-name' }, name),
            h('span', { className: 'nm-pill ' + status.cls },
              h('span', { className: 'nm-pill-dot', 'aria-hidden': true }),
              status.label),
            site.autoCheckIn ? h('span', { className: 'nm-tag' }, t('autoTag')) : null,
            info && info.turnstile
              ? h('span', { className: 'nm-badge nm-badge--warn' }, t('badgeTurnstile'))
              : null,
            needsCredential
              ? h('span', { className: 'nm-badge nm-badge--error' }, t('badgeNoCredential'))
              : null),
          h('div', { className: 'nm-site-head-right' },
            h('span', { className: 'nm-hint' }, t('enabledLabel')),
            h(Switch, {
              checked: !!site.enabled,
              disabled: isBusy,
              ariaLabel: t('enableSiteAria') + ' ' + name,
              onChange: (value) => onToggle(site, value),
            }))),
        h('div', { className: 'nm-site-meta' },
          infoLine ? h('span', { className: 'nm-site-subtitle' }, infoLine) : null,
          h('a', {
            className: 'nm-site-link',
            href: profileUrl(site.baseUrl),
            target: '_blank',
            rel: 'noopener noreferrer',
          }, site.baseUrl || name),
          h('span', null, authText(site, t)),
          h('span', null, quotaText(site.quota, t)),
          walletText(site.quota, t)
            ? h('span', { className: 'nm-site-wallet', title: t('walletHint') }, walletText(site.quota, t))
            : null,
          h('span', null, lastCheckInText(site, t)),
          failedMessage ? h('span', { className: 'nm-error-text' }, failedMessage) : null,
          !failedMessage && site.lastError ? h('span', { className: 'nm-error-text' }, site.lastError) : null),
        h('div', { className: 'nm-site-actions' },
          h('button', {
            type: 'button',
            className: 'nm-btn nm-btn-primary',
            onClick: () => onCheckIn(site),
            disabled: isBusy,
            'aria-busy': busy === 'checkin' ? 'true' : 'false',
          }, busy === 'checkin' ? t('checkingIn') : t('checkIn')),
          h('button', {
            type: 'button',
            className: 'nm-btn',
            onClick: () => onRefresh(site),
            disabled: isBusy,
            'aria-busy': busy === 'refresh' ? 'true' : 'false',
          }, busy === 'refresh' ? t('refreshing') : t('refresh')),
          h('button', {
            type: 'button',
            className: 'nm-btn',
            onClick: () => onEdit(site),
            disabled: isBusy,
          }, t('edit')),
          h('button', {
            type: 'button',
            className: 'nm-btn nm-btn-danger',
            onClick: () => onDelete(site),
            disabled: isBusy,
          }, busy === 'delete' ? t('deleting') : t('remove'))));
    }

    function SiteForm({ t, initial, onSubmit, onCancel }) {
      const isEdit = initial.mode === 'edit';
      const [name, setName] = useState(initial.name || '');
      const [baseUrl, setBaseUrl] = useState(initial.baseUrl || '');
      const [authMode, setAuthMode] = useState(initial.authMode === 'cookie' ? 'cookie' : 'bearer');
      const [token, setToken] = useState('');
      const [cookie, setCookie] = useState('');
      const [userId, setUserId] = useState(initial.userId == null ? '' : String(initial.userId));
      const [checkInPath, setCheckInPath] = useState(initial.checkInPath || '');
      const [autoCheckIn, setAutoCheckIn] = useState(initial.autoCheckIn !== false);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState(null);

      const hasStoredCredential = authMode === 'bearer' ? !!initial.hasToken : !!initial.hasCookie;

      async function handleSubmit(event) {
        if (event) event.preventDefault();
        if (saving) return;
        const trimmedBaseUrl = baseUrl.trim();
        const trimmedToken = token.trim();
        const trimmedCookie = cookie.trim();
        const trimmedUserId = userId.trim();
        const trimmedPath = checkInPath.trim();
        if (!trimmedBaseUrl) {
          setError(t('errorBaseUrlRequired'));
          return;
        }
        if (!/^https?:\/\/\S+$/i.test(trimmedBaseUrl)) {
          setError(t('errorBaseUrlInvalid'));
          return;
        }
        if (authMode === 'bearer' && !hasStoredCredential && !trimmedToken) {
          setError(t('errorTokenRequired'));
          return;
        }
        if (authMode === 'cookie' && !hasStoredCredential && !trimmedCookie) {
          setError(t('errorCookieRequired'));
          return;
        }
        if (authMode === 'cookie' && trimmedUserId && !/^\d+$/.test(trimmedUserId)) {
          setError(t('errorUserIdInvalid'));
          return;
        }
        setError(null);
        setSaving(true);
        try {
          await onSubmit({
            name: name.trim(),
            baseUrl: trimmedBaseUrl,
            authMode: authMode,
            token: trimmedToken,
            cookie: trimmedCookie,
            userId: trimmedUserId,
            checkInPath: trimmedPath,
            autoCheckIn: !!autoCheckIn,
          });
        } catch (err) {
          setError(errText(err));
        } finally {
          setSaving(false);
        }
      }

      return h('form', { className: 'nm-card nm-form', onSubmit: handleSubmit, noValidate: true },
        h('div', { className: 'nm-card-head' },
          h('div', { className: 'nm-card-head-text' },
            h('h3', { className: 'nm-card-title' }, isEdit ? t('editTitle') : t('addTitle')),
            h('p', { className: 'nm-card-desc' }, t('authHelp')))),
        error ? h('div', { className: 'nm-banner nm-banner--error', role: 'alert' },
          h('span', { className: 'nm-banner-text' }, error)) : null,
        h('div', { className: 'nm-field' },
          h('label', { className: 'nm-label', htmlFor: 'nm-form-name' }, t('formName')),
          h('input', {
            id: 'nm-form-name',
            className: 'nm-input',
            type: 'text',
            value: name,
            placeholder: t('formNamePlaceholder'),
            autoComplete: 'off',
            onChange: (event) => setName(event.target.value),
          })),
        h('div', { className: 'nm-field' },
          h('label', { className: 'nm-label', htmlFor: 'nm-form-base-url' }, t('formBaseUrl')),
          h('input', {
            id: 'nm-form-base-url',
            className: 'nm-input',
            type: 'url',
            value: baseUrl,
            placeholder: t('formBaseUrlPlaceholder'),
            autoComplete: 'off',
            required: true,
            onChange: (event) => setBaseUrl(event.target.value),
          })),
        h('div', { className: 'nm-field' },
          h('span', { className: 'nm-label', id: 'nm-form-auth-mode' }, t('authModeLabel')),
          h('div', { className: 'nm-seg', role: 'radiogroup', 'aria-labelledby': 'nm-form-auth-mode' },
            h('label', { className: 'nm-seg-item' + (authMode === 'bearer' ? ' nm-seg-item--on' : '') },
              h('input', {
                type: 'radio',
                name: 'nm-auth-mode',
                value: 'bearer',
                checked: authMode === 'bearer',
                onChange: () => setAuthMode('bearer'),
              }),
              h('span', { className: 'nm-seg-label' }, t('authBearer'))),
            h('label', { className: 'nm-seg-item' + (authMode === 'cookie' ? ' nm-seg-item--on' : '') },
              h('input', {
                type: 'radio',
                name: 'nm-auth-mode',
                value: 'cookie',
                checked: authMode === 'cookie',
                onChange: () => setAuthMode('cookie'),
              }),
              h('span', { className: 'nm-seg-label' }, t('authCookie'))))),
        authMode === 'bearer'
          ? h('div', { className: 'nm-field' },
            h('label', { className: 'nm-label', htmlFor: 'nm-form-token' }, t('formToken')),
            h('textarea', {
              id: 'nm-form-token',
              className: 'nm-textarea',
              value: token,
              rows: 2,
              spellCheck: false,
              placeholder: initial.hasToken ? t('formTokenStored') : t('formTokenPlaceholder'),
              onChange: (event) => setToken(event.target.value),
            }),
            h('span', { className: 'nm-hint' }, t('formTokenHint')))
          : h(React.Fragment, null,
            h('div', { className: 'nm-field' },
              h('label', { className: 'nm-label', htmlFor: 'nm-form-cookie' }, t('formCookie')),
              h('textarea', {
                id: 'nm-form-cookie',
                className: 'nm-textarea',
                value: cookie,
                rows: 3,
                spellCheck: false,
                placeholder: initial.hasCookie ? t('formCookieStored') : t('formCookiePlaceholder'),
                onChange: (event) => setCookie(event.target.value),
              }),
              h('span', { className: 'nm-hint' }, t('formCookieHint'))),
            h('div', { className: 'nm-field' },
              h('label', { className: 'nm-label', htmlFor: 'nm-form-user-id' }, t('formUserId')),
              h('input', {
                id: 'nm-form-user-id',
                className: 'nm-input',
                type: 'text',
                inputMode: 'numeric',
                value: userId,
                placeholder: t('formUserIdPlaceholder'),
                autoComplete: 'off',
                onChange: (event) => setUserId(event.target.value),
              }),
              h('span', { className: 'nm-hint' }, t('formUserIdHint')))),
        h('div', { className: 'nm-field' },
          h('label', { className: 'nm-label', htmlFor: 'nm-form-check-in-path' }, t('formCheckInPath')),
          h('input', {
            id: 'nm-form-check-in-path',
            className: 'nm-input',
            type: 'text',
            value: checkInPath,
            placeholder: t('formCheckInPathPlaceholder'),
            autoComplete: 'off',
            onChange: (event) => setCheckInPath(event.target.value),
          }),
          h('span', { className: 'nm-hint' }, t('formCheckInPathHint'))),
        h('div', { className: 'nm-row' },
          h('span', { className: 'nm-label', id: 'nm-form-auto-label' }, t('formAutoCheckIn')),
          h(Switch, {
            checked: !!autoCheckIn,
            disabled: saving,
            ariaLabel: t('formAutoCheckIn'),
            onChange: setAutoCheckIn,
          })),
        h('div', { className: 'nm-form-actions' },
          h('button', {
            type: 'submit',
            className: 'nm-btn nm-btn-primary',
            disabled: saving,
            'aria-busy': saving ? 'true' : 'false',
          }, saving ? t('formSaving') : (isEdit ? t('formSubmitSave') : t('formSubmitAdd'))),
          h('button', {
            type: 'button',
            className: 'nm-btn',
            onClick: onCancel,
            disabled: saving,
          }, t('formCancel'))));
    }

    /* ------------------------------------------------------------------ *
     * Page
     * ------------------------------------------------------------------ */
    function PageView({ t }) {
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [loadError, setLoadError] = useState(null);
      const [flash, setFlash] = useFlash();
      const [globalBusy, setGlobalBusy] = useState(null);
      const [siteBusy, setSiteBusy] = useState({});
      const [draft, setDraft] = useState(null);
      const [savingSettings, setSavingSettings] = useState(false);
      const [settingsNotice, setSettingsNotice] = useState(null);
      const [form, setForm] = useState(null);
      const settingsBaseRef = useRef(null);

      const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
          const next = await call('getState', null);
          setData(next);
        } catch (err) {
          setLoadError(errText(err));
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        load();
      }, [load]);

      // Keep the editable settings draft in sync with the server, but never
      // overwrite edits the user has not saved yet.
      useEffect(() => {
        if (!data) return;
        setDraft((prev) => {
          const base = settingsBaseRef.current;
          if (prev && base && !sameDraft(prev, base)) return prev;
          const next = toDraft(data.settings);
          settingsBaseRef.current = next;
          return next;
        });
      }, [data]);

      useEffect(() => {
        if (!settingsNotice || settingsNotice.kind !== 'success') return undefined;
        const timer = setTimeout(() => setSettingsNotice(null), 3000);
        return () => clearTimeout(timer);
      }, [settingsNotice]);

      const reloadQuiet = useCallback(async () => {
        try {
          const next = await call('getState', null);
          setData(next);
        } catch (_) {
          /* keep the last known state */
        }
      }, []);

      function patchSite(site) {
        if (!site) return;
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sites: prev.sites.map((item) => (item.id === site.id ? site : item)),
          };
        });
      }

      function clearSiteBusy(id) {
        setSiteBusy((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }

      async function handleRefreshAll() {
        if (globalBusy) return;
        setGlobalBusy('refresh');
        try {
          const next = await call('refreshAll', null);
          if (next && Array.isArray(next.sites)) {
            setData((prev) => (prev ? { ...prev, sites: next.sites } : prev));
          }
          const failed = next && Array.isArray(next.results)
            ? next.results.find((item) => item.status === 'failed')
            : null;
          if (failed) setFlash({ kind: 'error', text: t('refreshFailed') + (failed.message || failed.name || '') });
          else setFlash({ kind: 'success', text: t('flashRefreshAll') });
        } catch (err) {
          setFlash({ kind: 'error', text: t('refreshFailed') + errText(err) });
        } finally {
          setGlobalBusy(null);
        }
      }

      async function handleCheckAll() {
        if (globalBusy) return;
        setGlobalBusy('checkAll');
        try {
          const result = await call('checkInAll', null);
          if (result && Array.isArray(result.sites)) {
            setData((prev) => (prev ? { ...prev, sites: result.sites } : prev));
          }
          const results = result && Array.isArray(result.results) ? result.results : [];
          const count = (statusName) => results.filter((item) => item.status === statusName).length;
          const failed = count('failed');
          const manual = count('manual');
          const unsupported = count('unsupported');
          if (failed > 0) setFlash({ kind: 'warn', text: t('flashCheckInAllFailures') + ' ' + failed });
          else if (manual > 0) setFlash({ kind: 'warn', text: t('flashCheckInAllManual') + ' ' + manual });
          else if (unsupported > 0) setFlash({ kind: 'warn', text: t('flashCheckInUnsupported') + ' ' + unsupported });
          else setFlash({ kind: 'success', text: t('flashCheckInAll') });
          await reloadQuiet();
        } catch (err) {
          setFlash({ kind: 'error', text: t('checkAllFailed') + errText(err) });
        } finally {
          setGlobalBusy(null);
        }
      }

      async function handleCheckIn(site) {
        if (siteBusy[site.id]) return;
        setSiteBusy((prev) => ({ ...prev, [site.id]: 'checkin' }));
        try {
          const response = await call('checkInSite', { id: site.id });
          if (response && response.site) patchSite(response.site);
          const result = response && response.result;
          if (result && result.status === 'failed') {
            setFlash({ kind: 'error', text: t('checkInFailedPrefix') + (result.message || '') });
          } else if (result && result.status === 'manual') {
            setFlash({ kind: 'warn', text: t('flashCheckInManual') + (result.message ? '：' + result.message : '') });
          } else if (result && result.status === 'unsupported') {
            setFlash({ kind: 'warn', text: t('flashCheckInUnsupported') + (result.message ? '：' + result.message : '') });
          } else {
            let text = result && result.status === 'already' ? t('flashCheckInAlready') : t('flashCheckIn');
            if (result && result.quotaAwarded != null && Number(result.quotaAwarded) > 0) {
              const info = response.site && response.site.info ? response.site.info : null;
              const perUnit = info && info.quotaPerUnit != null ? Number(info.quotaPerUnit) : 0;
              let award;
              if (perUnit > 0) {
                const units = Number(result.quotaAwarded) / perUnit;
                if (info && info.quotaDisplayType === 'CUSTOM') {
                  const rate = typeof info.customCurrencyExchangeRate === 'number' && info.customCurrencyExchangeRate > 0
                    ? info.customCurrencyExchangeRate
                    : 1;
                  award = customAmount(units * rate, info.customCurrencySymbol || '');
                } else {
                  award = money(units);
                }
              } else {
                award = String(result.quotaAwarded) + ' ' + t('quotaUnit');
              }
              text += '：' + t('flashCheckInAwarded') + ' ' + award;
            }
            if (result && result.message) text += '：' + result.message;
            setFlash({ kind: 'success', text: text });
          }
          await reloadQuiet();
        } catch (err) {
          setFlash({ kind: 'error', text: t('checkInFailedPrefix') + errText(err) });
        } finally {
          clearSiteBusy(site.id);
        }
      }

      async function handleRefreshSite(site) {
        if (siteBusy[site.id]) return;
        setSiteBusy((prev) => ({ ...prev, [site.id]: 'refresh' }));
        try {
          const response = await call('refreshSite', { id: site.id });
          if (response && response.site) patchSite(response.site);
          setFlash({ kind: 'success', text: t('flashRefreshSite') });
          await reloadQuiet();
        } catch (err) {
          setFlash({ kind: 'error', text: t('refreshFailed') + errText(err) });
        } finally {
          clearSiteBusy(site.id);
        }
      }

      async function handleToggle(site, next) {
        if (siteBusy[site.id]) return;
        setSiteBusy((prev) => ({ ...prev, [site.id]: 'toggle' }));
        try {
          const response = await call('updateSite', { id: site.id, enabled: !!next });
          if (response && response.site) patchSite(response.site);
          setFlash({ kind: 'success', text: next ? t('siteEnabled') : t('siteDisabled') });
          await reloadQuiet();
        } catch (err) {
          setFlash({ kind: 'error', text: t('toggleFailed') + errText(err) });
        } finally {
          clearSiteBusy(site.id);
        }
      }

      async function handleDelete(site) {
        if (siteBusy[site.id]) return;
        const confirmed = window.confirm(t('deleteConfirm') + '\n' + siteName(site));
        if (!confirmed) return;
        setSiteBusy((prev) => ({ ...prev, [site.id]: 'delete' }));
        try {
          await call('removeSite', { id: site.id });
          setData((prev) => (prev
            ? { ...prev, sites: prev.sites.filter((item) => item.id !== site.id) }
            : prev));
          setForm((prev) => (prev && prev.mode === 'edit' && prev.id === site.id ? null : prev));
          setFlash({ kind: 'success', text: t('siteDeleted') });
          await reloadQuiet();
        } catch (err) {
          setFlash({ kind: 'error', text: t('deleteFailed') + errText(err) });
        } finally {
          clearSiteBusy(site.id);
        }
      }

      async function handleSaveSettings() {
        if (!draft || savingSettings) return;
        if (!/^\d{2}:\d{2}$/.test(draft.dailyTime)) {
          setSettingsNotice({ kind: 'error', text: t('errorTimeInvalid') });
          return;
        }
        setSavingSettings(true);
        setSettingsNotice(null);
        try {
          const response = await call('saveSettings', {
            settings: {
              autoCheckInEnabled: !!draft.autoCheckInEnabled,
              dailyTime: draft.dailyTime,
              jitterMinutes: Number(draft.jitterMinutes) || 0,
            },
          });
          const settings = response && response.settings ? response.settings : null;
          if (settings) {
            setData((prev) => (prev ? { ...prev, settings } : prev));
            const next = toDraft(settings);
            settingsBaseRef.current = next;
            setDraft(next);
          }
          setSettingsNotice({ kind: 'success', text: t('settingsSaved') });
        } catch (err) {
          setSettingsNotice({ kind: 'error', text: t('settingsSaveFailed') + errText(err) });
        } finally {
          setSavingSettings(false);
        }
      }

      function openAdd() {
        setForm({
          mode: 'add',
          id: null,
          name: '',
          baseUrl: '',
          authMode: 'bearer',
          userId: '',
          checkInPath: '',
          autoCheckIn: true,
        });
      }

      function openEdit(site) {
        setForm({
          mode: 'edit',
          id: site.id,
          name: site.name || '',
          baseUrl: site.baseUrl || '',
          authMode: site.authMode === 'cookie' ? 'cookie' : 'bearer',
          hasToken: !!site.hasToken,
          hasCookie: !!site.hasCookie,
          userId: site.userId == null ? '' : String(site.userId),
          checkInPath: site.checkInPath || '',
          autoCheckIn: site.autoCheckIn !== false,
        });
      }

      async function submitForm(values) {
        const target = form;
        if (!target) return;
        try {
          if (target.mode === 'add') {
            await call('addSite', {
              name: values.name || undefined,
              baseUrl: values.baseUrl,
              authMode: values.authMode,
              token: values.authMode === 'bearer' ? (values.token || undefined) : undefined,
              cookie: values.authMode === 'cookie' ? (values.cookie || undefined) : undefined,
              userId: values.authMode === 'cookie' && values.userId ? values.userId : undefined,
              checkInPath: values.checkInPath || undefined,
              autoCheckIn: values.autoCheckIn,
            });
          } else {
            await call('updateSite', {
              id: target.id,
              name: values.name,
              baseUrl: values.baseUrl,
              authMode: values.authMode,
              token: values.authMode === 'bearer' && values.token ? values.token : undefined,
              cookie: values.authMode === 'cookie' && values.cookie ? values.cookie : undefined,
              userId: values.authMode === 'cookie' ? values.userId : undefined,
              checkInPath: values.checkInPath,
              autoCheckIn: values.autoCheckIn,
            });
          }
          setForm(null);
          setFlash({
            kind: 'success',
            text: target.mode === 'add' ? t('flashSiteAdded') : t('flashSiteSaved'),
          });
          await reloadQuiet();
        } catch (err) {
          throw new Error(t('formSaveFailed') + errText(err));
        }
      }

      const sites = data && Array.isArray(data.sites) ? data.sites : [];
      const ready = !!(data && draft);
      const busy = globalBusy !== null;
      const dirty = !!(draft && data && !sameDraft(draft, toDraft(data.settings)));
      const jitterValues = draft ? jitterOptions(draft.jitterMinutes) : [0, 15, 30, 60, 120];

      function renderSettingsCard() {
        return h('section', { className: 'nm-card', 'aria-labelledby': 'nm-settings-title' },
          h('div', { className: 'nm-card-head' },
            h('div', { className: 'nm-card-head-text' },
              h('h3', { className: 'nm-card-title', id: 'nm-settings-title' }, t('autoSectionTitle')),
              h('p', { className: 'nm-card-desc' }, t('autoSectionDesc'))),
            h('div', { className: 'nm-switch-row' },
              h('span', { className: 'nm-label', id: 'nm-auto-label' }, t('autoCheckInLabel')),
              h(Switch, {
                checked: !!draft.autoCheckInEnabled,
                disabled: savingSettings,
                ariaLabel: t('autoCheckInLabel'),
                onChange: (value) => setDraft((prev) => ({ ...prev, autoCheckInEnabled: value })),
              }))),
          h('div', { className: 'nm-grid' },
            h('div', { className: 'nm-field' },
              h('label', { className: 'nm-label', htmlFor: 'nm-daily-time' }, t('dailyTimeLabel')),
              h('input', {
                id: 'nm-daily-time',
                className: 'nm-input',
                type: 'time',
                value: draft.dailyTime,
                disabled: savingSettings,
                onChange: (event) => setDraft((prev) => ({ ...prev, dailyTime: event.target.value })),
              }),
              h('span', { className: 'nm-hint' }, t('dailyTimeHint'))),
            h('div', { className: 'nm-field' },
              h('label', { className: 'nm-label', htmlFor: 'nm-jitter' }, t('jitterLabel')),
              h('select', {
                id: 'nm-jitter',
                className: 'nm-select',
                value: String(draft.jitterMinutes),
                disabled: savingSettings,
                onChange: (event) => setDraft((prev) => ({ ...prev, jitterMinutes: Number(event.target.value) })),
              }, jitterValues.map((value) => h('option', { key: value, value: String(value) },
                value === 0 ? t('jitterNone') : value + ' ' + t('minutesUnit')))),
              h('span', { className: 'nm-hint' }, t('jitterHint')))),
          !draft.autoCheckInEnabled
            ? h('p', { className: 'nm-hint nm-off-note' }, t('autoCheckInOffNote'))
            : null,
          h('div', { className: 'nm-row' },
            dirty ? h('button', {
              type: 'button',
              className: 'nm-btn nm-btn-primary',
              onClick: handleSaveSettings,
              disabled: savingSettings,
              'aria-busy': savingSettings ? 'true' : 'false',
            }, savingSettings ? t('savingSettings') : t('saveSettings')) : null,
            dirty ? h('span', { className: 'nm-hint' }, t('settingsUnsaved')) : null,
            settingsNotice
              ? h('span', { className: settingsNotice.kind === 'error' ? 'nm-error-text' : 'nm-success-text' },
                settingsNotice.text)
              : null));
      }

      function renderToolbar() {
        return h('div', { className: 'nm-toolbar' },
          h('button', {
            type: 'button',
            className: 'nm-btn',
            onClick: handleRefreshAll,
            disabled: busy || loading || !data,
            'aria-busy': globalBusy === 'refresh' ? 'true' : 'false',
          }, globalBusy === 'refresh' ? t('refreshing') : t('toolbarRefresh')),
          h('button', {
            type: 'button',
            className: 'nm-btn nm-btn-primary',
            onClick: handleCheckAll,
            disabled: busy || loading || sites.length === 0,
            'aria-busy': globalBusy === 'checkAll' ? 'true' : 'false',
          }, globalBusy === 'checkAll' ? t('toolbarCheckingAll') : t('toolbarCheckAll')),
          h('span', { className: 'nm-toolbar-spacer' }),
          h('button', {
            type: 'button',
            className: 'nm-btn',
            onClick: openAdd,
            disabled: busy,
          }, t('toolbarAdd')));
      }

      function renderEmpty() {
        return h('div', { className: 'nm-empty' },
          h('div', { className: 'nm-empty-title' }, t('emptyTitle')),
          h('p', { className: 'nm-desc' }, t('emptyLine1')),
          h('p', { className: 'nm-desc' }, t('emptyLine2')),
          h('p', { className: 'nm-desc' }, t('emptyLine3')),
          h('button', {
            type: 'button',
            className: 'nm-btn nm-btn-primary',
            onClick: openAdd,
          }, t('toolbarAdd')));
      }

      function renderForm() {
        if (!form) return null;
        return h(SiteForm, {
          key: form.mode + ':' + (form.id || 'new'),
          t: t,
          initial: form,
          onSubmit: submitForm,
          onCancel: () => setForm(null),
        });
      }

      function renderSites() {
        return h('div', { className: 'nm-sites' }, sites.map((site) => h(SiteCard, {
          key: site.id,
          t: t,
          site: site,
          busy: siteBusy[site.id] || null,
          onCheckIn: handleCheckIn,
          onRefresh: handleRefreshSite,
          onEdit: openEdit,
          onDelete: handleDelete,
          onToggle: handleToggle,
        })));
      }

      return h('div', { className: 'nm-root' },
        h('style', { key: 'nm-style' }, CSS),
        h('div', { className: 'nm-header' },
          h('h2', { className: 'nm-title' }, t('title')),
          h('p', { className: 'nm-desc' }, t('subtitle'))),
        flash ? h('div', {
          className: 'nm-banner nm-banner--' + flash.kind,
          role: flash.kind === 'error' ? 'alert' : 'status',
        }, h('span', { className: 'nm-banner-text' }, flash.text)) : null,
        loadError ? h('div', { className: 'nm-banner nm-banner--error', role: 'alert' },
          h('span', { className: 'nm-banner-text' }, t('loadFailed') + loadError),
          h('button', {
            type: 'button',
            className: 'nm-btn',
            onClick: load,
            disabled: loading,
          }, loading ? t('loading') : t('retry'))) : null,
        !ready && !loadError ? h('div', { className: 'nm-loading' }, t('loading')) : null,
        ready ? h('div', { className: 'nm-stack' },
          renderSettingsCard(),
          renderToolbar(),
          h('p', { className: 'nm-hint nm-auth-help' }, t('authHelp')),
          renderForm(),
          sites.length === 0 ? renderEmpty() : renderSites()) : null);
    }

    function makePage(t) {
      function NewApiManagerPage() {
        return h(PageView, { t: t });
      }
      NewApiManagerPage.displayName = 'NewApiManagerPage';
      return NewApiManagerPage;
    }

    /* ------------------------------------------------------------------ *
     * Styles: only --dsw-alias-* tokens, class prefix nm-
     * ------------------------------------------------------------------ */
    const CSS = `
.nm-root { display:flex; flex-direction:column; gap:14px; width:100%; max-width:720px; color:var(--dsw-alias-label-primary); font-size:13px; line-height:1.55; }
.nm-header { display:flex; flex-direction:column; gap:3px; }
.nm-title { margin:0; font-size:16px; font-weight:600; letter-spacing:0; }
.nm-desc { margin:0; font-size:12.5px; color:var(--dsw-alias-label-secondary); }
.nm-stack { display:flex; flex-direction:column; gap:12px; }
.nm-card { box-sizing:border-box; display:flex; flex-direction:column; gap:12px; padding:14px 16px; border:1px solid var(--dsw-alias-border-l1); border-radius:10px; background:var(--dsw-alias-bg-layer-1); }
.nm-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.nm-card-head-text { min-width:0; }
.nm-card-title { margin:0; font-size:13.5px; font-weight:600; }
.nm-card-desc { margin:2px 0 0; font-size:12px; color:var(--dsw-alias-label-secondary); }
.nm-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px 14px; }
.nm-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
.nm-label { font-size:12px; font-weight:500; color:var(--dsw-alias-label-secondary); }
.nm-hint { font-size:11.5px; color:var(--dsw-alias-label-secondary); }
.nm-off-note { margin:0; }
.nm-error-text { font-size:11.5px; color:var(--dsw-alias-state-error-primary); overflow-wrap:anywhere; }
.nm-success-text { font-size:11.5px; color:var(--dsw-alias-state-success-primary); }
.nm-input, .nm-select, .nm-textarea { box-sizing:border-box; width:100%; padding:6px 9px; border:1px solid var(--dsw-alias-border-l1); border-radius:7px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font-family:inherit; font-size:13px; }
.nm-select { cursor:pointer; }
.nm-textarea { min-height:70px; resize:vertical; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; line-height:1.5; }
.nm-input::placeholder, .nm-textarea::placeholder { color:var(--dsw-alias-label-secondary); opacity:.8; }
.nm-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.nm-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:5px 12px; border:1px solid var(--dsw-alias-border-l1); border-radius:7px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font-family:inherit; font-size:12.5px; font-weight:500; line-height:1.5; cursor:pointer; white-space:nowrap; }
.nm-btn:hover:not(:disabled) { border-color:var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-overlay); }
.nm-btn:active:not(:disabled) { transform:translateY(1px); }
.nm-btn:disabled { opacity:.55; cursor:not-allowed; }
.nm-btn-primary { border-color:var(--dsw-alias-brand-primary); background:var(--dsw-alias-brand-primary); color:var(--dsw-alias-bg-base); }
.nm-btn-primary:hover:not(:disabled) { border-color:var(--dsw-alias-brand-primary); background:var(--dsw-alias-brand-primary); opacity:.92; }
.nm-btn-danger { color:var(--dsw-alias-state-error-primary); }
.nm-btn-danger:hover:not(:disabled) { border-color:var(--dsw-alias-state-error-primary); background:var(--dsw-alias-bg-layer-2); }
.nm-switch { position:relative; flex:none; width:34px; height:20px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; background:var(--dsw-alias-bg-layer-2); cursor:pointer; transition:background-color .15s ease, border-color .15s ease; }
.nm-switch--on { border-color:var(--dsw-alias-brand-primary); background:var(--dsw-alias-brand-primary); }
.nm-switch-knob { position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:var(--dsw-alias-label-secondary); transition:transform .15s ease, background-color .15s ease; }
.nm-switch--on .nm-switch-knob { transform:translateX(14px); background:var(--dsw-alias-bg-base); }
.nm-switch--disabled { opacity:.55; cursor:not-allowed; }
.nm-switch-row { display:flex; align-items:center; gap:8px; }
.nm-banner { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; background:var(--dsw-alias-bg-layer-2); font-size:12.5px; }
.nm-banner-text { overflow-wrap:anywhere; }
.nm-banner--error { border-color:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-state-error-primary); }
.nm-banner--success { border-color:var(--dsw-alias-state-success-primary); color:var(--dsw-alias-state-success-primary); }
.nm-banner--warn { border-color:var(--dsw-alias-state-warn-primary); color:var(--dsw-alias-state-warn-primary); }
.nm-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.nm-toolbar-spacer { flex:1 1 auto; }
.nm-sites { display:flex; flex-direction:column; gap:10px; }
.nm-site { gap:10px; }
.nm-site-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.nm-site-title-wrap { display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-width:0; }
.nm-site-name { margin:0; font-size:13.5px; font-weight:600; overflow-wrap:anywhere; }
.nm-site-head-right { display:flex; align-items:center; gap:8px; margin-left:auto; }
.nm-pill { display:inline-flex; align-items:center; gap:5px; padding:1px 8px; border:1px solid var(--dsw-alias-border-l1); border-radius:999px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font-size:11.5px; white-space:nowrap; }
.nm-pill-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
.nm-pill--success { color:var(--dsw-alias-state-success-primary); }
.nm-pill--warn { color:var(--dsw-alias-state-warn-primary); }
.nm-pill--error { color:var(--dsw-alias-state-error-primary); }
.nm-pill--idle { color:var(--dsw-alias-state-idle-primary); }
.nm-tag { display:inline-flex; align-items:center; padding:0 7px; border:1px dashed var(--dsw-alias-border-l2); border-radius:999px; color:var(--dsw-alias-brand-primary); font-size:11px; white-space:nowrap; }
.nm-badge { display:inline-flex; align-items:center; padding:0 7px; border:1px solid currentColor; border-radius:999px; font-size:11px; white-space:nowrap; }
.nm-badge--warn { color:var(--dsw-alias-state-warn-primary); }
.nm-badge--error { color:var(--dsw-alias-state-error-primary); }
.nm-site-subtitle { color:var(--dsw-alias-label-secondary); font-size:11.5px; }
.nm-site-meta { display:flex; flex-direction:column; gap:3px; color:var(--dsw-alias-label-secondary); font-size:12px; overflow-wrap:anywhere; }
.nm-site-link { color:var(--dsw-alias-brand-primary); text-decoration:none; overflow-wrap:anywhere; }
.nm-site-link:hover { text-decoration:underline; }
.nm-site-wallet { color:var(--dsw-alias-label-primary); }
.nm-site-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.nm-empty { display:flex; flex-direction:column; align-items:center; gap:6px; padding:26px 20px; border:1px dashed var(--dsw-alias-border-l2); border-radius:10px; background:var(--dsw-alias-bg-layer-1); text-align:center; }
.nm-empty-title { font-size:13.5px; font-weight:600; }
.nm-empty .nm-desc { max-width:560px; }
.nm-form { gap:10px; }
.nm-auth-help { margin:-2px 0 0; }
.nm-seg { box-sizing:border-box; display:inline-flex; gap:2px; width:100%; padding:2px; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; background:var(--dsw-alias-bg-layer-2); }
.nm-seg-item { position:relative; flex:1 1 0; display:inline-flex; align-items:center; justify-content:center; padding:5px 10px; border:1px solid var(--dsw-alias-bg-layer-2); border-radius:6px; color:var(--dsw-alias-label-secondary); font-size:12.5px; text-align:center; cursor:pointer; }
.nm-seg-item--on { border-color:var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); }
.nm-seg-item input { position:absolute; width:1px; height:1px; margin:0; padding:0; opacity:0; pointer-events:none; }
.nm-seg-item:focus-within { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }
.nm-root .nm-seg-item input:focus-visible { outline:none; }
.nm-form-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.nm-loading { padding:18px; color:var(--dsw-alias-label-secondary); font-size:13px; text-align:center; }
.nm-root button:focus-visible, .nm-root a:focus-visible, .nm-root input:focus-visible, .nm-root textarea:focus-visible, .nm-root select:focus-visible, .nm-root .nm-switch:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.nm-root .nm-switch:focus-visible { outline-offset:3px; }
`;

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-new-api', { zh: zh, en: en }), 'dsh-new-api: locale');
        const t = ctx.locale.bind('dsh-new-api');
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-new-api',
          order: 25,
          label: () => t('nav'),
        }, makePage(t)));
      },
    };
  },
});
