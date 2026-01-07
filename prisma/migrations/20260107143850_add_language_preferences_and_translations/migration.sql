-- CreateTable
CREATE TABLE "chat_language_preferences" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "myLanguage" TEXT NOT NULL,
    "viewLanguage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_language_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_translations" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_language_preferences_userId_idx" ON "chat_language_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_language_preferences_chatId_userId_key" ON "chat_language_preferences"("chatId", "userId");

-- CreateIndex
CREATE INDEX "message_translations_lang_idx" ON "message_translations"("lang");

-- CreateIndex
CREATE UNIQUE INDEX "message_translations_messageId_lang_key" ON "message_translations"("messageId", "lang");

-- AddForeignKey
ALTER TABLE "chat_language_preferences" ADD CONSTRAINT "chat_language_preferences_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_language_preferences" ADD CONSTRAINT "chat_language_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_translations" ADD CONSTRAINT "message_translations_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
