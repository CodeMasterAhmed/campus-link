-- CreateTable
CREATE TABLE "RecruiterProfile" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "companyName" TEXT,
  "companyWebsite" TEXT,
  "companyAbout" TEXT,
  "hiringFocus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecruiterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterProfile_userId_key" ON "RecruiterProfile"("userId");

-- AddForeignKey
ALTER TABLE "RecruiterProfile"
ADD CONSTRAINT "RecruiterProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
