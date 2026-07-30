const jsonHeaders = { 'Content-Type': 'application/json' }

async function request(path, options = {}) {
  const response = await fetch(path, options)
  if (!response.ok) {
    const fallbackMessage = `Request failed: ${response.status}`
    const bodyText = await response.text()
    if (!bodyText) {
      throw new Error(fallbackMessage)
    }

    let message = fallbackMessage
    try {
      const parsed = JSON.parse(bodyText)
      message = parsed.message || fallbackMessage
    } catch {
      message = fallbackMessage
    }

    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}

export const apiClient = {
  getApis() {
    return request('/api/apis')
  },
  createApi(payload) {
    return request('/api/apis', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
  },
  getDownloads() {
    return request('/api/downloads')
  },
  createDownload(payload) {
    return request('/api/downloads', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    })
  },
}
