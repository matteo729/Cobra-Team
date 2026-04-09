// ==================== SUPABASE CONFIGURATION ====================
// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://hflaucrflhnaefzzqqpn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmbGF1Y3JmbGhuYWVmenpxcXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzQzOTYsImV4cCI6MjA5MTMxMDM5Nn0.V8DRzyiSbElDxC89gFKLMfhu28evKTYEKwkXlPm22KQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBAL STATE ====================
let inscriptionsOpen = true;

// ==================== COUNTDOWN FUNCTION ====================
function updateCountdown() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 15);
    targetDate.setHours(20, 0, 0, 0);
    
    const now = new Date();
    const difference = targetDate - now;
    
    if (difference <= 0) {
        document.getElementById('days').textContent = '00';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
        return;
    }
    
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (86400000)) / (3600000));
    const minutes = Math.floor((difference % 3600000) / 60000);
    const seconds = Math.floor((difference % 60000) / 1000);
    
    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

setInterval(updateCountdown, 1000);
updateCountdown();

// ==================== INSCRIPTION FUNCTIONS ====================
async function checkDNIExists(dni) {
    const { data, error } = await supabase
        .from('competitors')
        .select('dni')
        .eq('dni', dni)
        .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error checking DNI:', error);
        return false;
    }
    return !!data;
}

async function loadInscriptionStatus() {
    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'inscriptions_open')
        .single();
    
    if (!error && data) {
        inscriptionsOpen = data.value === 'true';
    } else {
        inscriptionsOpen = true;
    }
    updateInscriptionUI();
    return inscriptionsOpen;
}

function updateInscriptionUI() {
    const statusDiv = document.getElementById('inscriptionStatus');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!statusDiv) return;
    
    if (inscriptionsOpen) {
        statusDiv.textContent = 'Inscripciones abiertas - Complete el formulario';
        statusDiv.className = 'alert alert-info';
        if (submitBtn) submitBtn.disabled = false;
    } else {
        statusDiv.textContent = 'Inscripciones cerradas por la administración';
        statusDiv.className = 'alert alert-error';
        if (submitBtn) submitBtn.disabled = true;
    }
}

function showFormError(message) {
    const errorDiv = document.getElementById('formError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 4000);
    }
}

async function submitRegistration(event) {
    event.preventDefault();
    
    if (!inscriptionsOpen) {
        showFormError('Las inscripciones estan cerradas actualmente');
        return;
    }
    
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    const dni = document.getElementById('dni').value.trim();
    const peso = parseFloat(document.getElementById('peso').value);
    const cinturon = document.getElementById('cinturon').value;
    
    if (!nombre || !apellido || !dni || !peso || !cinturon) {
        showFormError('Todos los campos son obligatorios');
        return;
    }
    
    const exists = await checkDNIExists(dni);
    if (exists) {
        showFormError('Este DNI ya se encuentra registrado en el torneo');
        return;
    }
    
    const { error } = await supabase
        .from('competitors')
        .insert([{ 
            nombre, 
            apellido, 
            dni, 
            peso, 
            cinturon, 
            created_at: new Date() 
        }]);
    
    if (error) {
        console.error(error);
        showFormError('Error al procesar la inscripcion. Intente nuevamente');
    } else {
        alert('Inscripcion completada exitosamente');
        document.getElementById('registerForm').reset();
        const modal = document.getElementById('registerModal');
        if (modal) modal.style.display = 'none';
    }
}

// ==================== ADMIN FUNCTIONS ====================
async function loadCompetitors() {
    const { data, error } = await supabase
        .from('competitors')
        .select('*')
        .order('created_at', { ascending: false });
    
    const tbody = document.getElementById('tableBody');
    const totalSpan = document.getElementById('totalCount');
    
    if (error) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-state">Error cargando datos</td></tr>';
        return;
    }
    
    if (totalSpan) totalSpan.textContent = data.length;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-state">No hay competidores registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(comp => `
        <tr>
            <td>${comp.id}</td>
            <td>${comp.nombre}</td>
            <td>${comp.apellido}</td>
            <td>${comp.dni}</td>
            <td>${comp.peso} kg</td>
            <td>${comp.cinturon}</td>
            <td>${new Date(comp.created_at).toLocaleDateString()}</td>
            <td>
                <button class="edit-btn" data-id="${comp.id}">Editar</button>
                <button class="delete-btn" data-id="${comp.id}">Eliminar</button>
            </td>
        </tr>
    `).join('');
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteCompetitor(btn.dataset.id));
    });
}

async function deleteCompetitor(id) {
    if (confirm('¿Eliminar este competidor permanentemente?')) {
        const { error } = await supabase.from('competitors').delete().eq('id', id);
        if (error) {
            alert('Error al eliminar');
        } else {
            alert('Competidor eliminado');
            loadCompetitors();
        }
    }
}

async function openEditModal(id) {
    const { data, error } = await supabase
        .from('competitors')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) return;
    
    document.getElementById('editId').value = data.id;
    document.getElementById('editNombre').value = data.nombre;
    document.getElementById('editApellido').value = data.apellido;
    document.getElementById('editDni').value = data.dni;
    document.getElementById('editPeso').value = data.peso;
    document.getElementById('editCinturon').value = data.cinturon;
    
    document.getElementById('editModal').style.display = 'block';
}

async function saveEdit(event) {
    event.preventDefault();
    
    const id = document.getElementById('editId').value;
    const updatedData = {
        nombre: document.getElementById('editNombre').value,
        apellido: document.getElementById('editApellido').value,
        dni: document.getElementById('editDni').value,
        peso: parseFloat(document.getElementById('editPeso').value),
        cinturon: document.getElementById('editCinturon').value
    };
    
    const { error } = await supabase
        .from('competitors')
        .update(updatedData)
        .eq('id', id);
    
    if (error) {
        alert('Error al actualizar');
    } else {
        alert('Competidor actualizado');
        document.getElementById('editModal').style.display = 'none';
        loadCompetitors();
    }
}

async function toggleInscriptions(isChecked) {
    inscriptionsOpen = isChecked;
    
    const { error } = await supabase
        .from('settings')
        .upsert({ key: 'inscriptions_open', value: String(inscriptionsOpen) }, { onConflict: 'key' });
    
    if (error) console.error('Error saving status:', error);
    updateInscriptionUI();
}

// ==================== ADMIN INITIALIZATION ====================
function initAdmin() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const passwordInput = document.getElementById('adminPassword');
    const loginPanel = document.getElementById('loginPanel');
    const adminPanel = document.getElementById('adminPanel');
    const toggleSwitch = document.getElementById('inscriptionToggle');
    const refreshBtn = document.getElementById('refreshTableBtn');
    const toggleStatusText = document.getElementById('toggleStatusText');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const password = passwordInput.value;
            if (password === 'Cobra2024') {
                loginPanel.style.display = 'none';
                adminPanel.style.display = 'flex';
                await loadCompetitors();
                await loadInscriptionStatus();
                if (toggleSwitch) toggleSwitch.checked = inscriptionsOpen;
                if (toggleStatusText) {
                    toggleStatusText.textContent = inscriptionsOpen ? 'Abiertas' : 'Cerradas';
                }
            } else {
                const errorMsg = document.getElementById('loginError');
                if (errorMsg) errorMsg.style.display = 'block';
                setTimeout(() => {
                    if (errorMsg) errorMsg.style.display = 'none';
                }, 3000);
            }
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            loginPanel.style.display = 'flex';
            adminPanel.style.display = 'none';
            passwordInput.value = '';
        });
    }
    
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', async (e) => {
            await toggleInscriptions(e.target.checked);
            if (toggleStatusText) {
                toggleStatusText.textContent = e.target.checked ? 'Abiertas' : 'Cerradas';
            }
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCompetitors);
    }
    
    const closeModal = document.querySelector('.modal-custom-close');
    if (closeModal) {
        closeModal.onclick = () => document.getElementById('editModal').style.display = 'none';
    }
    
    const editForm = document.getElementById('editForm');
    if (editForm) editForm.addEventListener('submit', saveEdit);
    
    window.onclick = (event) => {
        const editModal = document.getElementById('editModal');
        if (event.target === editModal) editModal.style.display = 'none';
    };
}

// ==================== MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    await loadInscriptionStatus();
    
    const modal = document.getElementById('registerModal');
    const openBtn = document.getElementById('openRegisterBtn');
    const closeBtn = document.querySelector('.modal-close');
    
    if (openBtn) {
        openBtn.onclick = () => {
            if (modal) modal.style.display = 'block';
        };
    }
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            if (modal) modal.style.display = 'none';
        };
    }
    
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };
    
    const form = document.getElementById('registerForm');
    if (form) form.addEventListener('submit', submitRegistration);
    
    if (window.location.pathname.includes('admin.html')) {
        initAdmin();
        const loginPanel = document.getElementById('loginPanel');
        if (loginPanel) loginPanel.style.display = 'flex';
    }
});

window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.style.display = 'none';
    }, 3000);
});