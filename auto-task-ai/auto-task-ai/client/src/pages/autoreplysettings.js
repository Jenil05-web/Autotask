import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

const AutoReplySettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiRequest('/auto-reply/settings', 'GET');
      setSettings(response.settings || getDefaultSettings());
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(getDefaultSettings());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSettings = () => ({
    enabled: false,
    replyType: 'standard',
    aiTone: 'professional',
    useAI: true,
    customMessage: '',
    delayEnabled: false,
    delayType: 'immediate',
    delayAmount: 0,
    replyOnlyOnce: true,
    skipIfContainsKeywords: '',
    onlyDuringHours: false,
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00'
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest('/auto-reply/settings', 'POST', settings);
      alert('Auto-reply settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Auto-Reply Settings</h1>
      
      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({...settings, enabled: e.target.checked})}
            className="w-5 h-5 text-blue-600 rounded"
          />
          <span className="text-lg font-medium">Enable Auto-Reply</span>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Reply Type */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">Reply Type</h3>
            <div className="space-y-3">
              {['standard', 'out-of-office', 'custom'].map(type => (
                <label key={type} className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="replyType"
                    value={type}
                    checked={settings.replyType === type}
                    onChange={(e) => setSettings({...settings, replyType: e.target.value})}
                    className="text-blue-600"
                  />
                  <span className="capitalize">{type.replace('-', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Settings */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">AI Settings</h3>
            <label className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                checked={settings.useAI}
                onChange={(e) => setSettings({...settings, useAI: e.target.checked})}
                className="rounded"
              />
              <span>Use AI to generate replies</span>
            </label>

            {settings.useAI && (
              <div>
                <label className="block mb-2">AI Tone:</label>
                <select
                  value={settings.aiTone}
                  onChange={(e) => setSettings({...settings, aiTone: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
            )}

            {!settings.useAI && (
              <div>
                <label className="block mb-2">Custom Message:</label>
                <textarea
                  value={settings.customMessage}
                  onChange={(e) => setSettings({...settings, customMessage: e.target.value})}
                  className="w-full p-2 border rounded h-32"
                  placeholder="Enter your custom auto-reply message..."
                />
              </div>
            )}
          </div>

          {/* Delay Settings */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">Delay Settings</h3>
            <label className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                checked={settings.delayEnabled}
                onChange={(e) => setSettings({...settings, delayEnabled: e.target.checked})}
                className="rounded"
              />
              <span>Add delay before sending auto-reply</span>
            </label>

            {settings.delayEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2">Delay Type:</label>
                  <select
                    value={settings.delayType}
                    onChange={(e) => setSettings({...settings, delayType: e.target.value})}
                    className="w-full p-2 border rounded"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                
                {settings.delayType !== 'immediate' && (
                  <div>
                    <label className="block mb-2">Delay Amount:</label>
                    <input
                      type="number"
                      min="1"
                      max={settings.delayType === 'days' ? 30 : settings.delayType === 'hours' ? 24 : 60}
                      value={settings.delayAmount}
                      onChange={(e) => setSettings({...settings, delayAmount: parseInt(e.target.value)})}
                      className="w-full p-2 border rounded"
                      placeholder={`Enter ${settings.delayType}`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">Advanced Settings</h3>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.replyOnlyOnce}
                  onChange={(e) => setSettings({...settings, replyOnlyOnce: e.target.checked})}
                  className="rounded"
                />
                <span>Only reply once per email thread</span>
              </label>

              <div>
                <label className="block mb-2">Skip auto-reply if email contains these keywords:</label>
                <input
                  type="text"
                  value={settings.skipIfContainsKeywords}
                  onChange={(e) => setSettings({...settings, skipIfContainsKeywords: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="urgent, meeting, call (comma-separated)"
                />
              </div>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.onlyDuringHours}
                  onChange={(e) => setSettings({...settings, onlyDuringHours: e.target.checked})}
                  className="rounded"
                />
                <span>Only send auto-replies during business hours</span>
              </label>

              {settings.onlyDuringHours && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2">Business Hours Start:</label>
                    <input
                      type="time"
                      value={settings.businessHoursStart}
                      onChange={(e) => setSettings({...settings, businessHoursStart: e.target.value})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-2">Business Hours End:</label>
                    <input
                      type="time"
                      value={settings.businessHoursEnd}
                      onChange={(e) => setSettings({...settings, businessHoursEnd: e.target.value})}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="text-right">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2 rounded text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AutoReplySettings;