import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../server/database/schema";

const DEMO_PASSWORD = "Demo123!";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const seedConfirm = process.env.SEED_CONFIRM === "1";
  if (!seedConfirm) {
    console.error("ERROR: Seeding requires SEED_CONFIRM=1");
    console.error("Run: SEED_CONFIRM=1 npx tsx scripts/seed.ts");
    process.exit(1);
  }

  console.log("=".repeat(50));
  console.log("DATABASE SEEDING");
  console.log("=".repeat(50));
  console.log("This will add demo data to your database.");
  console.log("Demo password for all users:", DEMO_PASSWORD);
  console.log("=".repeat(50));

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  try {
    console.log("\n1. Creating permissions...");
    const permissionNames = [
      "users.read", "users.write", "users.delete",
      "orders.read", "orders.write", "orders.delete", "orders.assign",
      "couriers.read", "couriers.write", "couriers.verify",
      "addresses.read", "addresses.write",
      "roles.read", "roles.write",
      "audit.read",
      "webhooks.read", "webhooks.write",
      "flags.read", "flags.write",
      "bonus.read", "bonus.write",
      "subscriptions.read", "subscriptions.write",
      "partners.read", "partners.write",
    ];

    const permissions: { id: string; name: string }[] = [];
    for (const name of permissionNames) {
      const [perm] = await db.insert(schema.permissions)
        .values({ name, description: `Permission to ${name.replace(".", " ")}` })
        .onConflictDoNothing()
        .returning();
      if (perm) permissions.push(perm);
    }
    console.log(`   Created ${permissions.length} permissions`);

    console.log("\n2. Creating roles...");
    const rolesData = [
      { name: "client", description: "Regular client user" },
      { name: "courier", description: "Courier user" },
      { name: "staff_support", description: "Support staff" },
      { name: "staff_admin", description: "Administrator" },
      { name: "super_admin", description: "Super administrator with full access" },
    ];

    const roles: { id: string; name: string }[] = [];
    for (const roleData of rolesData) {
      const [role] = await db.insert(schema.roles)
        .values(roleData)
        .onConflictDoNothing()
        .returning();
      if (role) roles.push(role);
    }
    console.log(`   Created ${roles.length} roles`);

    console.log("\n3. Assigning permissions to roles...");
    const allPerms = await db.select().from(schema.permissions);
    const allRoles = await db.select().from(schema.roles);
    
    const roleMap = Object.fromEntries(allRoles.map(r => [r.name, r.id]));
    const permMap = Object.fromEntries(allPerms.map(p => [p.name, p.id]));

    const rolePermissions: Record<string, string[]> = {
      client: ["orders.read", "addresses.read", "addresses.write"],
      courier: ["orders.read", "addresses.read", "couriers.read"],
      staff_support: ["users.read", "orders.read", "orders.write", "couriers.read", "addresses.read", "audit.read"],
      staff_admin: ["users.read", "users.write", "orders.read", "orders.write", "orders.assign", "couriers.read", "couriers.write", "couriers.verify", "addresses.read", "roles.read", "audit.read", "webhooks.read", "flags.read", "bonus.read", "subscriptions.read", "partners.read"],
      super_admin: permissionNames,
    };

    for (const [roleName, perms] of Object.entries(rolePermissions)) {
      const roleId = roleMap[roleName];
      if (!roleId) continue;
      for (const permName of perms) {
        const permId = permMap[permName];
        if (!permId) continue;
        await db.insert(schema.rolePermissions)
          .values({ roleId, permissionId: permId })
          .onConflictDoNothing();
      }
    }
    console.log("   Role permissions assigned");

    console.log("\n4. Creating demo users...");
    const usersData = [
      { type: "client", phone: "+972501234567", email: "client@demo.clini.co.il" },
      { type: "client", phone: "+972501234568", email: "client2@demo.clini.co.il" },
      { type: "courier", phone: "+972502345678", email: "courier@demo.clini.co.il" },
      { type: "courier", phone: "+972502345679", email: "courier2@demo.clini.co.il" },
      { type: "staff", phone: "+972503456789", email: "support@demo.clini.co.il" },
      { type: "staff", phone: "+972503456790", email: "admin@demo.clini.co.il" },
    ];

    const createdUsers: { id: string; type: string; email: string | null }[] = [];
    for (const userData of usersData) {
      const [user] = await db.insert(schema.users)
        .values({ ...userData, passwordHash, status: "active" })
        .onConflictDoNothing()
        .returning();
      if (user) createdUsers.push(user);
    }
    console.log(`   Created ${createdUsers.length} users`);

    console.log("\n5. Assigning roles to users...");
    const allUsers = await db.select().from(schema.users);
    
    for (const user of allUsers) {
      let roleName = "client";
      if (user.type === "courier") roleName = "courier";
      else if (user.type === "staff") {
        roleName = user.email?.includes("admin") ? "staff_admin" : "staff_support";
      }
      
      const roleId = roleMap[roleName];
      if (roleId) {
        await db.insert(schema.userRoles)
          .values({ userId: user.id, roleId })
          .onConflictDoNothing();
      }
    }
    console.log("   User roles assigned");

    console.log("\n6. Creating addresses...");
    const clients = allUsers.filter(u => u.type === "client");
    const addressesData = [
      { city: "Tel Aviv", street: "Dizengoff", house: "50", apartment: "12", floor: 3, hasElevator: true },
      { city: "Tel Aviv", street: "Rothschild", house: "22", apartment: "5", floor: 2, hasElevator: false },
      { city: "Jerusalem", street: "Jaffa", house: "100", apartment: "8", floor: 4, hasElevator: true },
      { city: "Haifa", street: "Herzl", house: "15", apartment: "3", floor: 1, hasElevator: false },
    ];

    const createdAddresses: { id: string; userId: string }[] = [];
    for (let i = 0; i < addressesData.length; i++) {
      const userId = clients[i % clients.length]?.id;
      if (!userId) continue;
      
      const [addr] = await db.insert(schema.addresses)
        .values({ ...addressesData[i], userId })
        .returning();
      if (addr) createdAddresses.push(addr);
    }
    console.log(`   Created ${createdAddresses.length} addresses`);

    console.log("\n7. Creating courier profiles...");
    const courierUsers = allUsers.filter(u => u.type === "courier");
    for (const courier of courierUsers) {
      await db.insert(schema.couriers)
        .values({
          userId: courier.id,
          availabilityStatus: "online",
          verificationStatus: "verified",
          rating: "4.50",
          completedOrdersCount: 25,
        })
        .onConflictDoNothing();
    }
    console.log(`   Created ${courierUsers.length} courier profiles`);

    console.log("\n8. Creating demo orders...");
    const statuses = ["created", "scheduled", "assigned", "in_progress", "completed"];
    let orderCount = 0;
    
    for (let i = 0; i < Math.min(createdAddresses.length, 4); i++) {
      const addr = createdAddresses[i];
      const courier = courierUsers[i % courierUsers.length];
      const status = statuses[i % statuses.length];
      
      await db.insert(schema.orders)
        .values({
          clientId: addr.userId,
          addressId: addr.id,
          courierId: status === "assigned" || status === "in_progress" || status === "completed" ? courier?.id : null,
          status,
          price: 3500 + (i * 500),
          currency: "ILS",
          scheduledAt: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
          timeWindow: "10:00-12:00",
        });
      orderCount++;
    }
    console.log(`   Created ${orderCount} orders`);

    console.log("\n" + "=".repeat(50));
    console.log("SEEDING COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(50));
    console.log("\nDemo accounts:");
    console.log("  Client:  client@demo.clini.co.il / Demo123!");
    console.log("  Courier: courier@demo.clini.co.il / Demo123!");
    console.log("  Support: support@demo.clini.co.il / Demo123!");
    console.log("  Admin:   admin@demo.clini.co.il / Demo123!");
    console.log("=".repeat(50));

  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
