CREATE TYPE "ServiceType" AS ENUM ('MEDIDOR', 'CAJA', 'VALVULA', 'RECONEXION', 'DESCONEXION', 'FUGA');
CREATE TYPE "RequestStatus" AS ENUM ('BORRADOR', 'EN_REVISION', 'CORRECCION_DATOS', 'PENDIENTE_ESPECIFICACIONES', 'HABILITADA_PAGO');
CREATE TYPE "DisconnectionMode" AS ENUM ('TEMPORAL', 'DEFINITIVA');
CREATE TYPE "RequestAction" AS ENUM ('CREACION_BORRADOR', 'EDICION', 'ENVIO', 'REENVIO', 'SOLICITUD_CORRECCION', 'APROBACION_DATOS');
CREATE TYPE "RequestActor" AS ENUM ('CITIZEN', 'ADMIN');

CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "citizenId" TEXT NOT NULL,
    "service" "ServiceType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "nis" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "mode" "DisconnectionMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequestEvent" (
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" "RequestAction" NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "actorRole" "RequestActor" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("requestId", "version")
);

CREATE UNIQUE INDEX "ServiceRequest_number_key" ON "ServiceRequest"("number");
CREATE INDEX "ServiceRequest_citizenId_number_idx" ON "ServiceRequest"("citizenId", "number");
CREATE INDEX "ServiceRequest_status_number_idx" ON "ServiceRequest"("status", "number");
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
