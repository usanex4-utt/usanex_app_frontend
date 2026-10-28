// Every path below was taken from the real FastAPI backend (backend/routes/*.py).
// Nothing here is a guess. Path helpers take the PUBLIC user_id (e.g. "UN123456")
// unless noted.
export const EP = {
  // ── auth (routes/auth.py) ──────────────────────────────────
  login: "/api/auth/login",                          // {identifier, password}
  logout: "/api/auth/logout",
  me: "/api/auth/me",
  registerSendOtp: "/api/auth/register/send-otp",    // {name, mobile, password}
  registerVerify: "/api/auth/register/verify",       // {name, mobile, password, otp}
  forgotSendOtp: "/api/auth/forgot-password/send-otp",
  forgotReset: "/api/auth/forgot-password/reset",

  // ── search (routes/search.py) ──────────────────────────────
  searchPeople: "/api/search/people",                // ?q=&limit=&offset=

  // ── connections (routes/connections.py) ────────────────────
  connections: "/api/connections",                   // accepted connections
  connectionRequest: "/api/connections/request",     // {user_id}
  connectionRequests: "/api/connections/requests",   // pending, received
  connectionAccept: (requestId) => `/api/connections/request/${requestId}/accept`,
  connectionReject: (requestId) => `/api/connections/request/${requestId}/reject`,
  connectionNotifications: "/api/connections/notifications",
  connectionNotificationRead: "/api/connections/notifications/read", // {notification_id}
  connectionCategory: "/api/connections/category",   // POST {connected_user_id, category: friend|family}
  connectionCategoryRemove: (id) => `/api/connections/category/${id}`, // DELETE
  follow: "/api/connections/follow",                 // POST {user_id}
  unfollow: "/api/connections/unfollow",             // POST {user_id}
  followStatus: (id) => `/api/connections/follow-status/${id}`,

  // ── profile (routes/profile.py) ────────────────────────────
  myProfile: "/api/profile/me",                      // GET / PUT
  myPhoto: "/api/profile/me/photo",                  // POST multipart "photo"
  profile: (id) => `/api/profile/${id}`,             // connected users only

  // ── reels (routes/reels.py) ────────────────────────────────
  reelsFeed: "/api/reels/feed",                      // ?limit=&cursor=
  reelsMine: "/api/reels/me/list",
  reelsSaved: "/api/reels/me/saved",
  reelsOfUser: (id) => `/api/reels/user/${id}/list`,
  reelUpload: "/api/reels/upload",                   // multipart video, caption, hashtags, language, category
  reelWatch: (id) => `/api/reels/${id}/watch`,
  reelRating: (id) => `/api/reels/${id}/rating`,     // {rating: 1..3}
  reelSave: (id) => `/api/reels/${id}/save`,         // POST / DELETE
  reelShare: (id) => `/api/reels/${id}/share`,       // {share_type}
  reelComments: (id) => `/api/reels/${id}/comments`, // GET / POST {content}
  reelComment: (id, cid) => `/api/reels/${id}/comments/${cid}`, // DELETE
  reelReport: (id) => `/api/reels/${id}/report`,     // {reason, description}
  reelNotInterested: (id) => `/api/reels/${id}/not-interested`,
  reelDelete: (id) => `/api/reels/${id}`,            // DELETE

  // ── private chat (routes/chat.py) ──────────────────────────
  chatHistory: (id) => `/api/chat/${id}`,
  chatSend: "/api/chat/send",                        // multipart receiver_id, content, file
  chatRead: (id) => `/api/chat/${id}/read`,
  chatDelete: (messageId) => `/api/chat/message/${messageId}/delete`,
  chatWs: (id) => `/api/chat/ws/${id}`,              // websocket: typing + presence

  // ── couple chat (routes/couple_realtime.py) ────────────────
  coupleWs: (id) => `/ws/couple/${id}`,              // websocket

  // ── NEXA AI (routes/ai_assistant.py) ───────────────────────
  nexaChat: "/api/ai-assistant/chat",                // {message}
  nexaStatus: "/api/ai-assistant/status",
};
