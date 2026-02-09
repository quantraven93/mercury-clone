"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { Bell, Mail, MessageCircle, Save, Check } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState({
    email_alerts: true,
    telegram_alerts: false,
    telegram_chat_id: "",
    alert_before_hearing_hours: 24,
  });

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) {
          setPrefs({
            email_alerts: data.preferences.email_alerts ?? true,
            telegram_alerts: data.preferences.telegram_alerts ?? false,
            telegram_chat_id: data.preferences.telegram_chat_id || "",
            alert_before_hearing_hours:
              data.preferences.alert_before_hearing_hours ?? 24,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure your notification preferences
          </p>
        </div>

        {/* Email Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Email Alerts
                </p>
                <p className="text-xs text-gray-500">
                  Receive case updates via email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.email_alerts}
                onChange={(e) =>
                  setPrefs({ ...prefs, email_alerts: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Telegram Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Telegram Alerts
                </p>
                <p className="text-xs text-gray-500">
                  Receive instant updates via Telegram
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.telegram_alerts}
                onChange={(e) =>
                  setPrefs({ ...prefs, telegram_alerts: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {prefs.telegram_alerts && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={prefs.telegram_chat_id}
                onChange={(e) =>
                  setPrefs({ ...prefs, telegram_chat_id: e.target.value })
                }
                placeholder="e.g., 123456789"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 font-medium mb-1">
                  How to get your Chat ID:
                </p>
                <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                  <li>Open Telegram and search for @BotFather</li>
                  <li>Send /newbot and follow the steps to create a bot</li>
                  <li>Copy the bot token and add it to your environment variables</li>
                  <li>Send any message to your new bot</li>
                  <li>
                    Visit{" "}
                    <code className="bg-gray-200 px-1 rounded">
                      https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
                    </code>
                  </li>
                  <li>Find your chat_id in the response</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Alert Timing */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Bell className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Hearing Reminders
              </p>
              <p className="text-xs text-gray-500">
                Get notified before upcoming hearings
              </p>
            </div>
          </div>
          <select
            value={prefs.alert_before_hearing_hours}
            onChange={(e) =>
              setPrefs({
                ...prefs,
                alert_before_hearing_hours: Number(e.target.value),
              })
            }
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
          >
            <option value={1}>1 hour before</option>
            <option value={6}>6 hours before</option>
            <option value={12}>12 hours before</option>
            <option value={24}>24 hours before (1 day)</option>
            <option value={48}>48 hours before (2 days)</option>
          </select>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save Settings"}
            </>
          )}
        </button>
      </div>
    </DashboardShell>
  );
}
