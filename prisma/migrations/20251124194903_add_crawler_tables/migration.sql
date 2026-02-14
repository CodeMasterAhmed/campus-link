/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `College` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `College` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('MAIN', 'BACKLOG', 'REVAL', 'SUPPLEMENTARY');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PASSED', 'FAILED', 'PROMOTED', 'DETAINED', 'MALPRACTICE', 'ABSENT');

-- AlterTable
ALTER TABLE "College" ADD COLUMN     "code" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ResultLink" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedDate" TIMESTAMP(3),
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "monthYear" TEXT,
    "semester" INTEGER,
    "type" "ExamType" NOT NULL DEFAULT 'MAIN',
    "resultLinkId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResult" (
    "id" SERIAL NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "examId" INTEGER NOT NULL,
    "sgpa" DECIMAL(4,2),
    "resultStatus" "ResultStatus" NOT NULL,
    "studentAcademicId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectResult" (
    "id" SERIAL NOT NULL,
    "studentResultId" INTEGER NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "grade" TEXT,
    "credits" DECIMAL(3,1),
    "resultStatus" "ResultStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultLink_url_key" ON "ResultLink"("url");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResult_rollNumber_examId_key" ON "StudentResult"("rollNumber", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "College_code_key" ON "College"("code");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_resultLinkId_fkey" FOREIGN KEY ("resultLinkId") REFERENCES "ResultLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResult" ADD CONSTRAINT "StudentResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResult" ADD CONSTRAINT "StudentResult_studentAcademicId_fkey" FOREIGN KEY ("studentAcademicId") REFERENCES "StudentAcademic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectResult" ADD CONSTRAINT "SubjectResult_studentResultId_fkey" FOREIGN KEY ("studentResultId") REFERENCES "StudentResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
